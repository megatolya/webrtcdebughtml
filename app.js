const socket = window.socket = io.connect('https://localhost:8888', {transports: ['websocket']});

var onevent = socket.onevent;

socket.onevent = function (packet) {
    var args = packet.data || [];
    onevent.call (this, packet);    // original call
    packet.data = ["*"].concat(args);
    onevent.call(this, packet);      // additional call to catch-all
};
socket.on('connect', () => {
    console.log(socket.id); // 'G5p5...'
});

socket.on("*",function(event,data) {
    console.log('from socket.io', event, data);
});

const configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
const pcPeers = {};
let localStream;

function createPC(socketId, isOffer) {
  // console.log('createPC', socketId, 'isOffer', isOffer);
  const pc = new RTCPeerConnection(configuration);
  pc.addStream(localStream);
  pcPeers[socketId] = pc;

  pc.onicecandidate = function (event) {
    console.log('onicecandidate!', event.candidate);
    if (event.candidate) {
      socket.emit('candidate', {'to': socketId, 'candidate': event.candidate });
    }
  };

  function createOffer() {
    pc.createOffer(function(desc) {
      pc.setLocalDescription(desc, function () {
        socket.emit('video-offer', {'to': socketId, 'sdp': pc.localDescription });
      }, console.error);
    }, console.error);
  }

  pc.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }

  pc.oniceconnectionstatechange = function(event) {
    console.log('oniceconnectionstatechange', event.target.iceConnectionState);
    if (event.target.iceConnectionState === 'completed') {
      setTimeout(() => {
        getStats();
      }, 1000);
    }
         if (event.target.iceConnectionState === 'connected') {
      createDataChannel();
    }
  };
  pc.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event.target.signalingState);
  };

  pc.onaddstream = function (event) {
    console.log('onaddstream', event.stream);

    console.log(event);
    setVideo('remote', event.stream);
    console.log(event.stream.toURL());
  };
  pc.onremovestream = function (event) {
    console.log('onremovestream', event.stream);
  };

  pc.addStream(localStream);

  function createDataChannel() {
    if (pc.textDataChannel) {
      return;
    }
    const dataChannel = pc.createDataChannel("text");

    dataChannel.onerror = function (error) {
      console.log("dataChannel.onerror", error);
    };

    dataChannel.onmessage = function (event) {
      console.log("dataChannel.onmessage:", event.data);
    };


    dataChannel.onopen = function () {
      console.log('dataChannel.onopen');
    };

    dataChannel.onclose = function () {
      console.log("dataChannel.onclose");
    };

    pc.textDataChannel = dataChannel;
  }
  return pc;
}

// socket.on('message', function (data) {
    // console.log('got message', data);
    // console.log('trying exchange');
    // if (data && data.sdp) {
        // exchange(data);
    // } else if (data) {
        // const candidate = new RTCIceCandidate(data.candidate);
        // console.log('adding candidate', candidate);
        // Object.keys(pcPeers).forEach(socketId => {
            // console.log(pcPeers[socketId]);
            // console.log('before');
            // pcPeers[socketId].addIceCandidate(candidate);
            // console.log('AFTER!!!!!1');
        // });
    // }
// });

socket.on('candidate', function (data) {
  const fromId = data.from;

  let pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    console.warn('dont know such client! skip');
    console.warn('dont know such client! skip');
    console.warn('dont know such client! skip');
    return;
  }

  pc.addIceCandidate(new RTCIceCandidate(data.candidate));
});
socket.on('video-answer', function (data) {
    console.log('got video-answer!', data);
    pcPeers[data.from].setRemoteDescription(new RTCSessionDescription(data.sdp));
});

socket.on('roommates', function(socketIds){
    for (const i in socketIds) {
        const socketId = socketIds[i];
        console.log('roommates', socketIds);
        createPC(socketId, true);
    }
});

navigator.getUserMedia({audio: false, video: true}, stream => {
    localStream = stream;
    setVideo('local', localStream);
    socket.emit('join', '1');
}, console.error);

function setVideo(type, stream) {
    const video = $('#' + type)[0];
    video.srcObject = stream;
    video.onloadedmetadata = function(e) {
        video.play();
    };
}
