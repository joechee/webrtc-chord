


(function (window) {

  /*
  Constants
  */

  var BIT_SIZE = 32;
  var RETRY_COUNT = 10;

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
    this.called = false;
  }


  Request.prototype.respond = function (msg) {
    if (!this.called) {
      this.called = true;
      this.transport.respond(this.data.from, this.requestID, msg); 
    } else {
      throw new Error("Respond called twice for this request!");
    }
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

  function TimeoutError() {
    Error.apply(this, arguments);
  }
  TimeoutError.prototype = new Error();

  function Transport() {
  }

  Transport.prototype.init = function (node) {
    this.parent = node;
    this.requestCallbacks = {};
    this.requestTypeDispatcher = {};
    this.messageTypeDispatcher = {};

    var self = this;

    function clearRequests() {
      for (var i in self.requestCallbacks) {
        if (new Date() - self.requestCallbacks[i].timestamp > 10000) {
          var errorCallback = self.requestCallbacks[i].errorCallback;
          console.error("Request timeout!");
          if (errorCallback) {
            (function (i) {
              setTimeout(function () {
                errorCallback(new TimeoutError("Request Timeout"));
                delete self.requestCallbacks[i];
              }, 0);
            })(i);
          }
        }
      }
      setTimeout(function () {
        clearRequests();
      }, 1000);
    }

    clearRequests();
    

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

  Transport.prototype.request = function (msg, callback, errorCallback) {
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
      errorCallback: errorCallback,
      timestamp: new Date(),
      msg: msg // For debugging purposes
    };

    this._send(request);
  };

  Transport.prototype.messageHandler = function (msg) {
    switch (msg.type) {
      case "request":
        var request = new Request(this, msg.data, msg.requestID)
        this._requestHandler(request);
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
      delete this.requestCallbacks[response.requestID];
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
    this.messageBuffer = [];

    this.introducers = {};


    this.registerRequestType('findPredecessor', function (request) {
      self._findPredecessor(request.data.id, function (response) {
        request.respond(response);
      });
    });

    this.registerRequestType('updateFingerTable', function (request) {
      var nodeId = request.data.data.val;
      var pos = request.data.data.pos;
      // Update the introducer
      if (request.data.introducer 
        && request.data.introducer !== self.parent.id
        && !self.introducers[nodeId]) {
        self.introducers[nodeId] = request.data.introducer;
      }
      self.updateSelfFingerTable(nodeId, pos, function (result) {
        if (result) {
          request.respond({success:true});
        }
      });
    });

    this.registerRequestType('forwardRequest', function (request) {
      var newRequest = request.data.data;
      newRequest.from = self.parent.id;
      self.request(newRequest, function (response) {
        request.respond(response);
      });
    });

    this.registerMessageType('forwardSend', function (msg) {
      var newMsg = msg.data;
      newMsg.from = self.parent.id;
      self.send(newMsg);
    });

    peerTable.messageHandler = function (msg) {
      self.messageHandler(msg);
    };

    setInterval(function () {
      self.clearBuffer();
    }, 100);

  };

  FingerTable.prototype.clearBuffer = function () {
    var self = this;
    var msgBuffer = this.messageBuffer;
    this.messageBuffer = [];
    msgBuffer.map(function (bufferObj) {
      var msg = bufferObj.msg;
      var timestamp = bufferObj.timestamp;
      if (new Date() - timestamp < 5000) {
        self._send(msg, timestamp);
      } else {
        if (msg.type === "RTCMessage"
          || (msg.type === "request" && msg.data && msg.data.type === "RTCMessage")) {
          console.error("RTCMessage dropped!");
          console.error(msg);
        } else {
          console.log("Message dropped!");
          console.log(msg);
        }
      }
    });

    // Take care of introducers as well
    for (var i in this.introducers) {
      if (!this.peerTable.getPeers()[i] || this.peerTable.getPeers()[i].status === "connected") {
        delete this.introducers[i];
      }
    }
  };

  FingerTable.prototype._send = function (msg, timestamp) {
    Transport.prototype._send.apply(this, arguments);

    // Hook to make sure that requests are turned into forwardRequests

    if (!msg.ttl) {
      msg.ttl = BIT_SIZE * 2;
    }
    if (!msg.route) {
      msg.route = [this.parent.id];
    } else {
      msg.route.push(this.parent.id);
    }
    
    var id = parseInt(msg.recipient, 10);

    var closestPeer;

    if (this.peerTable.getPeers()[id]
      && this.peerTable.getPeers()[id].status === "connected") {
      closestPeer = id;
    } else {
      closestPeer = this.peerTable.queryClosestPredecessorId(id);
    }


    // Do the actual sending

    if (id === this.parent.id) {
      throw new Error("Attempt to send message to self");
    } else if (closestPeer === this.parent.id) {
      this.messageBuffer.push({
        msg: msg,
        timestamp: timestamp || new Date()
      });
    } else if (forwardDistance(closestPeer, id) < forwardDistance(this.parent.id, id)){
      // Make a request to another peer to find successor
      this.peerTable.getPeers()[closestPeer].send(msg);
    } else {
      // This is the case where the user sends an RTCMessage to
      // a node that is further away because he is not connected 
      // to the mesh yet
      throw new Error("This should not happen!");
    }
  };

  FingerTable.prototype.messageHandler = function (msg) {
    if (parseInt(msg.recipient, 10) === parseInt(this.parent.id, 10)) {
      if (msg.type === "RTCMessage") {
        // check if msg contains an introducer, if so, record it so that we
        // can communicate indirectly with this node
        if (!this.introducers[msg.originalSender] && msg.introducer) {
          this.introducers[msg.originalSender] = msg.introducer;
        }
      }
      Transport.prototype.messageHandler.apply(this, arguments);
    } else {
      this.forward(msg);
    }
  };

  FingerTable.prototype.request = function (msg, callback) {
    if (msg.type === "RTCMessage"
      && this.introducers[msg.recipient]
      && this.peerTable.getPeers()[msg.recipient].status !== "connected") {
      this.forwardRequest(
        this.introducers[msg.recipient],
        msg,
        callback
      );
    } else {
      Transport.prototype.request.apply(this, arguments);
    }
  };

  FingerTable.prototype.send = function (msg) {
    if (msg.type === "RTCMessage"
      && this.introducers[msg.recipient]
      && this.peerTable.getPeers()[msg.recipient].status !== "connected") {
      this.forwardSend(this.introducers[msg.recipient], msg);
    } else {
      Transport.prototype.send.apply(this, arguments);
    }
  };

  FingerTable.prototype.forwardSend = function (target, msg) {
    msg.introducer = target;
    var msg = {
      data: msg,
      recipient: target,
      from: this.parent.id,
      type: "forwardSend"
    };
    this.send(msg);
  };

  FingerTable.prototype.forward = function (msg) {
    if (msg.ttl) {
      msg.ttl = msg.ttl - 1;
    } else {
      msg.ttl = 2 * BIT_SIZE;
    }

    if (msg.ttl) {
      this._send(msg);
    } else if (msg.ttl < 0) {
      throw new Error('TTL that is less than 0!');
    } else {
      throw new Error("Message dropped because of TTL!");
    }
  };

  FingerTable.prototype.disconnect = function () {
    var peers = this.peerTable.getPeers();
    for (var peer in peers) {
      peers[peer].disconnect();
    }
  }

  FingerTable.prototype.join = function (target, callback) {
    var self = this;
    if (target) {
      this.initFingerTable(target, function () {
        self.updateOthers(function () {
          if (callback) {
            callback();
          }
        });
      });
    } else {
      for (var i = 0; i < BIT_SIZE; i++) {
        this.fingerTable[i] = this.parent.id;
      }
      this.predecessor = this.parent.id;
    }
  };

  FingerTable.prototype.fingerInterval = function (pos) {
    return {
      start: modulo(this.parent.id + Math.pow(2, pos), INT32_MAX),
      end: modulo(this.parent.id + Math.pow(2, pos + 1) - 1, INT32_MAX)
    };
  };

  FingerTable.prototype.set = function (pos, id, introducer) {
    if (id === undefined) {
      throw new Error("Trying to set an undefined value in FingerTable");
    } else if (pos >= BIT_SIZE) {
      throw new Error("Trying to set an index that is out of bounds");
    }
    id = parseInt(id, 10);
    var self = this;
    self.fingerTable[pos] = id;
    if (!self.peerTable.getPeers()[id] && id !== self.parent.id) {
      var newPeer = new Peer(self, self.parent, id);
      if (introducer) {
        this.introducers[id] = introducer;
      }
      newPeer._initiateConnection();
    }
  };

  FingerTable.prototype.initFingerTable = function (target, callback) {
    var self = this;
    this.findPredecessor(target, this.parent.id, function (response) {
      var requests = 0;
      var checkRequestsDone = function () {
        if (requests < 0) {
          throw new Error("Requests are done already!");
        } else if (requests === 0) {
          callback(true);
        }
      }
      self.set(0, response.successor, target);
      for (var i = 1; i < BIT_SIZE ; i++) {
        if (self.fingerInterval(i).start >= self.parent.id 
          && self.fingerInterval(i).start < self.fingerTable[i - 1]
          && self.fingerTable[i - 1] !== undefined) {
          self.set(i, self.fingerTable[i - 1]);
        } else {
          requests++;
          (function (i) {
            self.findPredecessor(target, self.fingerInterval(i).start, function (response) {
              self.set(i, response.successor, target);
              requests--;
              checkRequestsDone();
            });
          })(i);
        }
      }
      checkRequestsDone();
    });
  };

  FingerTable.prototype.updateOthers = function (callback) {
    var self = this;
    var requests = BIT_SIZE;
    var checkRequestsDone = function () {
      if (requests < 0) {
        throw new Error("Requests are already done!");
      } else if (requests === 0) {
        if (callback) {
          callback(true);
        }
      }
    }
    for (var i = 0; i < BIT_SIZE; i++) {
      (function (i) {
        self._findPredecessor(modulo(self.parent.id - Math.pow(2, i), INT32_MAX),
          function (response) {
            self.updateFingerTable(response.predecessor, self.parent.id, i, function (callback) {
              requests--;
              checkRequestsDone();
              // infinite loop?
            });
          }
        );
      })(i);
    }
    checkRequestsDone();
  };

  FingerTable.prototype.forwardRequest = function (target, msg, callback) {
    if (!callback) {
      throw new Error("No callback specified!");
    }
    msg.introducer = target;

    var forwardRequest = {
      type: "forwardRequest",
      data: msg,
      recipient: target,
      from: msg.from
    };
    this.request(forwardRequest, callback);
  };

  FingerTable.prototype.respond = function () {
    Transport.prototype.respond.apply(this, arguments);
  };

  FingerTable.prototype._findPredecessor = function (id, callback, times) {
    var closestPredecessor;
    var self = this;

    times = times ? times : 0;

    if (times > RETRY_COUNT) {
      throw new Error("Could not find successor!");
    }

    var predecessorId = self.peerTable.queryClosestPredecessorId(id);

    if (predecessorId === self.parent.id) {
      var successor = self.peerTable.queryClosestSuccessorId(id);
      if (successor) {
        setTimeout(function () {
          callback({
            predecessor: self.parent.id,
            successor: successor
          });
        }, 0);  
      } else {
        setTimeout(function () {
          self._findPredecessor(id, callback, times + 1);
        }, 100);
      }
      
      
    } else {
      self.findPredecessor(predecessorId, id, callback);
    }
  };

  FingerTable.prototype.findPredecessor = function (target, id, callback, errCallback) {
    var self = this;
    if (target === self.parent.id) {
      self._findPredecessor(id, callback);
    } else {
      self.request({
        recipient: target,
        from: self.parent.id,
        type: 'findPredecessor',
        id: id
      }, callback, errCallback);  
    }
    
  };

  // Updates nodeId's finger table to include selfId at position pos
  FingerTable.prototype.updateFingerTable = function (nodeId, selfId, pos, callback) {
    if (parseInt(nodeId, 10) !== parseInt(this.parent.id, 10)) {
      this.request({
        recipient: nodeId,
        from: selfId,
        type: 'updateFingerTable',
        data: {
          val: selfId,
          pos: pos        
        },
        introducer: this.peerTable.queryRandomPeerId()
      }, function () {
        if (callback) {
          callback();
        }
      });
    } else {
      callback();
    }
  };

  FingerTable.prototype.updateSelfFingerTable = function (id, pos, callback) {
    if (pos >= BIT_SIZE) {
      throw new Error("Trying to add more values to FingerTable!");
    }
    if (forwardDistance(self.parent.id, id) >= 0 && forwardDistance(id, this.fingerTable[pos]) > 0){
      this.set(pos, id);
      var pred = this.peerTable.queryClosestPredecessorId(this.parent.id);
      this.updateFingerTable(pred, this.parent.id, pos, function () {
        if (callback) {
          callback(true);
        }
      });
    } else {
      if (callback) {
        callback(true);
      }
    }
  };

  FingerTable.prototype.stabilize = function (callback) {
    var self = this;
    var oldSuccessor = self.peerTable.queryClosestSuccessorId(self.parent.id);

    if (!oldSuccessor) {
      // Delay 1000 milliseconds and call callback (which is likely to call stabilize again)
      setTimeout(callback, 1000);
      return; 
    }

    self.findPredecessor(oldSuccessor, oldSuccessor,
      function (response) {
        var successor = parseInt(response.predecessor, 10);
        if (successor !== self.peerTable.queryClosestSuccessorId(self.parent.id)
          && successor !== self.parent.id
          && !self.parent.getPeers()[successor]) {
          self.introducers[successor] = oldSuccessor;
          var newPeer = new Peer(self, self.parent, successor);
          newPeer._initiateConnection();
        }
        callback();
      }, callback
    );
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
