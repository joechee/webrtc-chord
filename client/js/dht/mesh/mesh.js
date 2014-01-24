


(function (window) {

  /*
  Constants
  */

  // Check if a dictionary is empty
  function isEmpty(ob){
    for(var i in ob){ return false;}
    return true;
  }

  function getSize(ob) {
    var length = 0;
    for(var i in ob){ length++;}
    return length;
  }

  function getSortedKeys(obj, lambda) {
    var keys = [];
    for (var i in obj) {
      keys.push(i);
    }
    keys.sort(lambda);
  }

  /*
  Request
  */

  function Request(transport, data, requestID) {
    this.transport = transport;
    this.data = data;
    this.requestID = requestID;
    this.type = this.data.type;
  }


  Request.prototype.respond = function (msg) {
    this.transport.respond(this.data.from, this.requestID, msg);
  };




  /*
  Transport
  ---------

  A base class for sending messages from a peer to another. 
  Used for bootstrapping WebRTC Connections.

  Classes that need to be extended:
  - _send: Should actually send out the message through the transport channel
  - messageHandler: Should process the message, and call the parent implementation as well

  */

  function Transport() {
  }

  Transport.prototype.init = function (node) {
    this.parent = node;
    this.requestCallbacks = {};
    this.requestTypeDispatcher = {};
    this.messageTypeDispatcher = {};
  };

  Transport.prototype._send = function (msg) {
    if (!msg.recipient) {
      throw new Error("No recipient defined!");
    } else if (!msg.from) {
      throw new Error("No sender defined!");
    }
  };

  Transport.prototype.send = function (msg) {
    this._send(msg);
  };

  Transport.prototype.respond = function (recipient, requestID, msg) {
    var response = {
      requestID: requestID,
      type: "response",
      data: msg,
      recipient: recipient,
      from: this.parent.id
    };
    this._send(response);
  };

  Transport.prototype.request = function (msg, callback) {
    if (!callback) {
      throw new Error("No callback specified!");
    }
    var request = {
      requestID: Random.generate(),
      type: "request",
      data: msg,
      recipient: msg.recipient,
      from: msg.from
    };

    this.requestCallbacks[request.requestID] = {
      callback: callback,
      timestamp: new Date()
    };

    this._send(request);
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
        this._requestHandler(new Request(this, msg.data, msg.requestID));
        break;
      case "response":
        this._responseHandler(msg);
        break;
      default:
        if (this.messageTypeDispatcher[msg.type]) {
          this.messageTypeDispatcher[msg.type](msg);
        } else {
          throw new Error("Unknown message type: " + msg.type);
        }
        break;
    }
  };

  Transport.prototype._requestHandler = function (request) {
    if (!(request instanceof Request)) {
      throw new Error("This is not a request!");
    } else if (this.requestTypeDispatcher[request.type]){
      this.requestTypeDispatcher[request.type](request);
    } else {
      throw new Error("Unknown request type: " + request.type);
    }
  };

  Transport.prototype._responseHandler = function (response) {
    if (this.requestCallbacks[response.requestID]) {
      this.requestCallbacks[response.requestID].callback(response.data);
      delete response['requestID'];
    } else {
      throw new Error("Response received for no request!");
    }
  };

  Transport.prototype.registerMessageType = function (type, handler) {
    this.messageTypeDispatcher[type] = handler;
  };

  Transport.prototype.registerRequestType = function (type, handler) {
    this.requestTypeDispatcher[type] = handler;
  };




  /*
  FingerTable
  ------------

  A Chord Implementation. It implements Transport

  */

  function FingerTable(peerTable) {
    this.init(peerTable);
  }
  FingerTable.prototype = new Transport();

  FingerTable.prototype.init = function (peerTable) {

    this.peerTable = peerTable;
    var self = this;

    Transport.prototype.init.apply(this, arguments);
    this.fingerTable = [];

    this.registerRequestType('findPredecessor', function (request) {
      self.findPredecessor(request.data.id, function (response) {
        request.respond(response);
      });
    });


    this.registerRequestType('discoverFingerTable', function (request) {
      var requestsPending = self.fingerTable.length;
      var fingerTable = [];
      for (var i = 0; i < self.fingerTable.length; i++) {
        var peerId = self.fingerTable[i];
        if (peerId === self.parent.id) {
          requestsPending--;
          fingerTable[i] = self.peerTable.queryClosestSuccessorId(self.parent.id);
          checkRequestsDone();
        } else {
          (function (i, peerId) {
            self.peerTable[peerId].request({
              recipient: peerId,
              from: self.parent.id,
              type: 'findPredecessor',
              id: peerId
            }, function (response) {
              fingerTable[i] = response.successor;
              requestsPending--;
              checkRequestsDone();
            });

          })(i, peerId);
        }
      }

      function checkRequestsDone() {
        if (requestsPending === 0) {
          request.respond({
            fingerTable: fingerTable
          });
        }
      }
    });

    peerTable.messageHandler = function (msg) {
      self.messageHandler(msg);
    };

  };

  FingerTable.prototype._send = function (msg) {
    Transport.prototype._send.apply(this, arguments);
    
    var id = msg.recipient;

    /*
    var closestPeer = this.parent.id;

    for (var i = 0; i < this.fingerTable.length; i++) {
      var currentId = this.fingerTable[i];
      if (forwardDistance(currentId, id) < forwardDistance(closestPeer, id)) {
        closestPeer = currentId;
      }
    }

    */

    var closestPeer = this.peerTable.queryClosestId(id);

    if (closestPeer === this.parent.id) {
      console.log("id does not exist! Dropping message");
    } else if (forwardDistance(closestPeer, id) < forwardDistance(this.parent.id, id)){
      // Make a request to another peer to find successor
      this.peerTable.getPeers()[closestPeer].send(msg);
    } else {
      throw new Error("This should not happen!");
    }
  };

  FingerTable.prototype.messageHandler = function (msg) {
    if (parseInt(msg.recipient, 10) === parseInt(this.parent.id, 10)) {
      Transport.prototype.messageHandler.apply(this, arguments);
    } else {
      this.forward(msg);
    }
  };

  FingerTable.prototype.forward = function (msg) {
    // Should have mechanism to prevent infinite loops
    this._send(msg);
  };

  FingerTable.prototype.disconnect = function () {
    for (var peer in this.table) {
      this.table[peer].disconnect();
    }
  }

  FingerTable.prototype.build = function () {
    var self = this;
    var peers = this.peerTable.getPeers();
    if (isEmpty(peers)) {

      for (var i = 0; i < 32; i++) {
        this.fingerTable[i] = this.parent.id;
      }
      return;
    } else {
      var self = this;
      var peerId;
      for (peerId in peers) {break;} // Get a peer from the peers dictionary
      for (var i = 0; i < 32; i++) {  // Fill a stub finger table
        this.fingerTable[i] = peerId;
      }
      this.request({
        recipient: peerId,
        from: this.parent.id,
        type: "findPredecessor",  
        id: this.parent.id
      }, function (response) {
        if (self.parent.id === response.successor && self.parent.id === response.predecessor) {
          // There are only 2 nodes in the mesh, me and the predecessor
        } else {
          var successor = self.peerTable.getPeers()[response.successor];
          if (!successor) {
            successor = new Peer(self, self.parent, response.successor);
          }
          self.request({
            recipient: successor.id,
            from: self.parent.id,
            type: "discoverFingerTable"
          }, function (response) {
            self.fingerTable = response.fingerTable;

            for (var i = 0; i < self.fingerTable.length; i++) {
              if (!self.peerTable[self.fingerTable[i]]) {
                new Peer(self, self.parent, self.fingerTable[i]);
              }
            }
            // TODO: Update other nodes that should have the current node in the fingerTable as well.
            for (var i = 0; i < self.fingerTable.length; i++) {
              self.findPredecessor(Math.pow(2, i), function (response) {
                console.log(response.predecessor);
                console.log(response.successor);
              });
            }
          });
        }
      });  
    }
  };

  FingerTable.prototype.rebuild = function () {
    this.fingerTable = {};
    this.build();
  };

  FingerTable.prototype.respond = function () {
    Transport.prototype.respond.apply(this, arguments);
  };

  FingerTable.prototype.findPredecessor = function (id, callback) {
    var closestPredecessor;
    var self = this;

    var predecessorId = self.peerTable.queryClosestPredecessorId(id);

    if (predecessorId === self.parent.id) {
      var successor = self.peerTable.queryClosestSuccessorId(id);
      callback({
        predecessor: self.parent.id,
        successor: successor
      });
    } else {
      self.request({
        recipient: predecessorId,
        from: self.parent.id,
        type: 'findPredecessor'
      }, function (response) {
        callback(response);
      });
    }
  };

  /*

  WebSocketTransport
  ------------------

  A WebSocket wrapper that implements Transport. This is necessary to bootstrap the
  very first connection

  */

  var hostname = location.origin.replace(/^http/, 'ws');

  function WebSocketTransport(node) {
    Transport.prototype.init.apply(this, arguments);
    this.init(node);
  }

  WebSocketTransport.SocketConstants = {
    CONNECTING: 0, 
    OPEN: 1, 
    CLOSING: 2, 
    CLOSED: 3
  };

  WebSocketTransport.prototype = new Transport();

  WebSocketTransport.prototype._send = function (msg) {
    Transport.prototype._send.apply(this, arguments);
    if (this.webSocketConnection.readyState === WebSocketTransport.SocketConstants.CONNECTING) {
      this.messageBuffer.push(msg);
    } else if (this.webSocketConnection.readyState === WebSocketTransport.SocketConstants.OPEN) {
      this.webSocketConnection.send(JSON.stringify(msg));
    } else {
      // WebSocketConnection is either closing or closed
    }

  };


  WebSocketTransport.prototype.init = function () {
    var self = this;
    this.webSocketConnection = new WebSocket(hostname);
    this.messageBuffer = [];

    this.webSocketConnection.onopen = function () {
      if (self.onready) {
        self.onready(self);
      }
      self._send({
        from: self.parent.id,
        recipient: "server",
        type: "identity"
      });
      self.messageBuffer.map(function (msg) {
        self._send(msg);
      });
    };

    this.webSocketConnection.onmessage = function (e) {
      self.messageHandler(JSON.parse(e.data));
    };


  };




  WebSocketTransport.prototype.messageHandler = function (msg) {
    Transport.prototype.messageHandler.apply(this, arguments);
  };

  WebSocketTransport.prototype.close = function () {
    this.webSocketConnection.close();
  };

  window.WebSocketTransport = WebSocketTransport;
  window.Transport = Transport;
  window.FingerTable = FingerTable;



})(window);
