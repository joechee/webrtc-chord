
var INT32_MAX = 2147483647;

var hostname = location.origin.replace(/^http/, 'ws');

var IS_CHROME = !!window.webkitRTCPeerConnection,
    RTCPeerConnection,
    RTCIceCandidate,
    RTCSessionDescription;

if (IS_CHROME) {
  RTCPeerConnection = webkitRTCPeerConnection;
  RTCIceCandidate = window.RTCIceCandidate;
  RTCSessionDescription = window.RTCSessionDescription;
} else {
  RTCPeerConnection = mozRTCPeerConnection;
  RTCIceCandidate = mozRTCIceCandidate;
  RTCSessionDescription = mozRTCSessionDescription;
}

(function (window) {

	var RTCConfig = {
		iceServers: [
			{ 
				'url': 'stun:23.21.150.121'// (IS_CHROME ? 'stun:stun.l.google.com:19302' : 'stun:23.21.150.121')
			}
		]
	};



  /*

  Request


  */

  function Request(transport, data, requestID) {
    this.transport = transport;
    this.data = data;
    this.requestID = requestID;
  }


  Request.prototype.respond = function (msg) {
    this.transport.respond(msg, this.requestID);
  };




  /*
  Transport
  ---------

  A base class for bootstrapping WebRTC Connections.

  Classes that need to be extended:
  - _send: Should actually send out the message through the transport channel
  - messageHandler: Should process the message, and call the parent implementation as well
  - requestHandler: Should process the request, and call the respond method in the request object

  Should implement a mechanism that forwards the message to messageHandler as well when received

  */

  function Transport() {
    this.requestCallbacks = {};
  }

  Transport.prototype._send = function (msg) {
    if (!msg.recipient) {
      throw new Error("No recipient defined!");
    } else if (!msg.from) {
      throw new Error("No sender defined!");
    }

  };

  Transport.prototype.send = function (msg) {
    var message = {
      data: msg,
      type: "message"
    };
    this._send(JSON.stringify(msg));
  };

  Transport.prototype.request = function (msg, callback) {
    var request = {
      data: msg,
      requestID: Random.generate(),
      type: "RTCRequest"
    };

    this.requestCallbacks[request.requestID] = {
      callback: callback,
      timestamp: new Date()
    };

    this._send(JSON.stringify(request));
  };

  Transport.prototype._sendRTCMessage = function (msg) {
    throw new Error("Not implemented!");
  };

  Transport.prototype._sendRTCRequest = function (msg) {
    throw new Error("Not implemented!");
  };

  Transport.prototype.messageHandler = function (msg) {
    switch (msg.type) {
      case "request":
        this.requestHandler(new Request(this, msg.data, msg.requestID));
        break;
      case "response":
        this._responseHandler(msg);
        break;
    }
  };

  Transport.prototype.requestHandler = function (request) {
    if !(request instanceof Request) {
      throw new Error("This is not a request!");
    }
  };

  Transport.prototype._responseHandler = function (response) {
    if (this.requestCallbacks[request.requestID]) {
      this.requestCallbacks[request.requestID].callback(response);
    } else {
      throw new Error("Response received for no request!");
    }
  };


  /*
  FingerTable
  ------------

  A Chord Implementation. It implements Transport

  */

  function FingerTable() {}
  FingerTable.prototype = new Transport();

  FingerTable.prototype._send = function (msg) {
    Transport.prototype._send.apply(this, arguments);
    
    var closestPeer;

    var id = msg.recipient;
    for (var peer in this.table) {
      if (forwardDistance(closestPeer, id) > forwardDistance(peer, id)) {
        closestPeer = peer;
      }
    }

    if (closestPeer === this.parent.id) {
      // At this point in time, this is going to be the closest predecessor one can find
      // Check if relative
      if (msg.relative === "successor") {
        callback(this, msg);
      } else if (msg.relative === "predecessor") {
        // Handle message
        callback(this, msg);
      } else {
        callback(undefined, msg);
      }
    } else {
      // Make a request to another peer to find successor
      closestPeer.message(msg);
    }
  };


  /*

  WebSocketTransport
  ------------------

  A WebSocket wrapper that implements Transport. This is necessary to bootstrap the
  very first connection

  */

  var hostname = location.origin.replace(/^http/, 'ws');

  function WebSocketTransport() {}

  WebSocketTransport.prototype.send = function () {

  };



  

