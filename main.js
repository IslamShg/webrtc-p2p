const APP_ID = 'f5ae8e531eff494f92f28ab17c73066b'

let token = null
let uid = String(Math.floor(Math.random() * 10000))
let client
let channel

const queryString = window.location.search
const urlParams = new URLSearchParams(queryString)
const roomId = urlParams.get('room')

if (!roomId) {
  window.location = 'lobby.html'
}

let localStream
let remoteStream
let peerConnection

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
    }
  ]
}

const constrains = {
  video: {
    width: { min: 640, ideal: 1920, max: 1920 },
    height: { min: 480, ideal: 1080, max: 1080 },
  },
  audio: false
}

const init = async () => {
  //? 1: create client object and log in
  client = await AgoraRTM.createInstance(APP_ID)
  await client.login({ uid, token })

  //? 2: create and join the channel
  channel = client.createChannel('main')
  await channel.join()

  channel.on('MemberJoined', handleUserJoined)
  channel.on('MemberLeft', handleUserLeft)

  client.on('MessageFromPeer', handleMessageFromPeer)

  //? 3: Get local video and audio from user
  try {
    localStream = await navigator.mediaDevices.getUserMedia(constrains)
    document.getElementById('user-1').srcObject = localStream
  } catch (e) {
    alert('Доступ к видео и аудио отклонён')
  }
}

const createOffer = async (MemberId) => {
  await createPeerConnection(MemberId)

  //? creating an offer
  const offer = await peerConnection.createOffer()
  //? after setting description it's gonna send requests to stun servers and create ice candidates
  await peerConnection.setLocalDescription(offer)

  client.sendMessageToPeer(
    {
      text: JSON.stringify({ type: 'offer', offer })
    },
    MemberId
  )
}

init()

const handleUserJoined = async (memberId) => {
  createOffer(memberId)
}

const handleMessageFromPeer = async (messageInfo, MemberId) => {
  // MemberId is an id of peer1 who sent a message
  const message = JSON.parse(messageInfo.text)

  if (message.type === 'offer') {
    createAnswer(MemberId, message.offer)
  }

  if (message.type === 'answer') {
    addAnswer(message.answer)
  }

  if (message.type === 'candidate' && peerConnection) {
    peerConnection.addIceCandidate(message.candidate)
  }
}

const handleUserLeft = async () => {
  document.getElementById('user-2').style.display = 'none'
}

const leaveChannel = async () => {
  await channel.leave()
  await client.logout()
}

window.addEventListener('beforeunload', leaveChannel)

const createAnswer = async (MemberId, offer) => {
  // creating an answer as an second(remove) peer and setting descs
  await createPeerConnection(MemberId)
  await peerConnection.setRemoteDescription(offer)
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)

  client.sendMessageToPeer(
    {
      text: JSON.stringify({ type: 'answer', answer })
    },
    MemberId
  )
}

const createPeerConnection = async (MemberId) => {
  peerConnection = new RTCPeerConnection(servers)
  remoteStream = new MediaStream()

  const secondUserDiv = document.getElementById('user-2')
  const firstUserDiv = document.getElementById('user-1')
  secondUserDiv.srcObject = remoteStream
  secondUserDiv.style.display = 'block'
  firstUserDiv?.classList.add('smallFrame')

  //? get our local tracks and add them to our remote peer
  localStream?.getTracks().forEach((track) => {
    peerConnection.addTrack(track, localStream)
  })

  //? listen to our remote peer to get their tracks
  peerConnection.addEventListener('track', (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream.addTrack(track)
    })
  })

  //? this will be fired off by setLocalDescription
  peerConnection.onicecandidate = async (event) => {
    if (event.candidate) {
      client.sendMessageToPeer(
        {
          text: JSON.stringify({
            type: 'candidate',
            candidate: event.candidate
          })
        },
        MemberId
      )
    }
  }
}

const addAnswer = async (answer) => {
  if (!peerConnection.currentRemoteDescription) {
    // peer1 sets his remote description
    peerConnection.setRemoteDescription(answer)
  }
}

const purpleColor = 'rgb(179, 102, 249, .9)'
const redColor = 'rgb(255, 80, 80)'

const toggleCamera = () => {
  const videoTrack = localStream
    .getTracks()
    .find((track) => track.kind === 'video')

  videoTrack.enabled = !videoTrack.enabled
  document.getElementById('camera-btn').style.backgroundColor =
    videoTrack.enabled ? purpleColor : redColor
}
const toggleAudio = () => {
  const audioTrack = localStream
    .getTracks()
    .find((track) => track.kind === 'audio')

  audioTrack.enabled = !audioTrack.enabled
  document.getElementById('mic-btn').style.backgroundColor = audioTrack.enabled
    ? purpleColor
    : redColor
}

const toggleCameraButton = document.getElementById('camera-btn')
const toggleAudioButton = document.getElementById('mic-btn')
toggleCameraButton?.addEventListener('click', toggleCamera)
toggleAudioButton?.addEventListener('click', toggleAudio)
