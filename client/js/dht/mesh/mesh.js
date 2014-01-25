


(function (window) {

  /*
  Constants
  */

  var BIT_SIZE = 32;

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

  Transport.prototype.request = function (msg, callback, debug) {
    if (!callback) {
      throw new Error("No callback specified!");
    }
    var request = {
      requestID: Random.generate(),
      type: "request",
      data: msg,
      recipient: msg.recipient,
      from: msg.from,
      debug: debug
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
        if (msg.debug) {
          console.log(msg);
        }
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
      self._findPredecessor(request.data.id, function (response) {
        request.respond(response);
      });
    });

    this.registerRequestType('updateFingerTable', function (request) {
      var nodeId = request.data.val;
      var pos = request.data.pos;
      self.updateSelfFingerTable(nodeId, pos, function (result) {
        if (result) {
          request.respond({success:true});
        }
      });
    });

    peerTable.messageHandler = function (msg) {
      self.messageHandler(msg);
    };

  };

  FingerTable.prototype._send = function (msg) {
    Transport.prototype._send.apply(this, arguments);
    
    var id = parseInt(msg.recipient, 10);

    var closestPeer = this.peerTable.queryClosestId(id);

    if (id === this.parent.id) {
      console.error("Warning: Attempt to send message to self");
    } else if (closestPeer === this.parent.id) {
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

  FingerTable.prototype.join = function (target, callback) {
    var self = this;
    if (target) {
      this.initFingerTable(target, function () {
        self.updateOthers();
        if (callback) {
          callback();
        }
      });
    } else {
      for (var i = 0; i < BIT_SIZE; i++) {
        this.fingerTable = this.parent.id;
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

  FingerTable.prototype.set = function (pos, id) {
    id = parseInt(id, 10);
    var self = this;
    self.fingerTable[pos] = id;
    if (!self.peerTable.getPeers()[id] && id !== self.parent.id) {
      var newPeer = new Peer(self, self.parent, id);
      newPeer._initiateConnection(true);
    }
  };

  FingerTable.prototype.initFingerTable = function (target, callback) {
    var self = this;
    this.findPredecessor(target, this.parent.id, function (response) {
      var requests = 0;
      function checkRequestsDone() {
        if (requests < 0) {
          throw new Error("Requests are done already!");
        } else if (requests === 0) {
          callback(true);
        }
      }
      self.fingerTable[0] = response.successor;
      for (var i = 1; i < BIT_SIZE ; i++) {
        if (self.fingerInterval(i).start >= self.parent.id 
          && self.fingerInterval(i).start < self.fingerTable[i - 1]
          && self.fingerTable[i - 1] !== undefined) {
          self.set(i, self.fingerTable[i - 1]);
        } else {

          (function (i) {
            requests++;
            self._findPredecessor(self.fingerInterval(i).start, function (response) {
              self.set(i + 1, response.successor);
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
    var requests = 0;
    function checkRequestsDone() {
      if (requests < 0) {
        throw new Error("Requests are already done!");
      } else if (requests === 0) {
        callback(true);
      }
    }
    for (var i = 0; i < BIT_SIZE; i++) {
      (function (i) {
        requests++;
        self._findPredecessor(modulo(self.parent.id - Math.pow(2, i), INT32_MAX),
          function (response) {
            self.updateFingerTable(response.predecessor, self.parent.id, i, function (callback) {
              requests--;
              checkRequestsDone();
            });
          }
        );
      })(i);
    }
    checkRequestsDone();
  };

  FingerTable.prototype.respond = function () {
    Transport.prototype.respond.apply(this, arguments);
  };

  FingerTable.prototype._findPredecessor = function (id, callback) {
    var closestPredecessor;
    var self = this;

    var predecessorId = self.peerTable.queryClosestPredecessorId(id);

    if (predecessorId === self.parent.id) {
      var successor = self.peerTable.queryClosestSuccessorId(id);
      setTimeout(function () {
        callback({
          predecessor: self.parent.id,
          successor: successor
        });
      }, 0);
    } else {
      self.findPredecessor(predecessorId, id, callback);
    }
  };

  FingerTable.prototype.findPredecessor = function (target, id, callback) {
    var self = this;
    if (target === self.parent.id) {
      self._findPredecessor(id, callback);
    } else {
      self.request({
        recipient: target,
        from: self.parent.id,
        type: 'findPredecessor',
        id: id
      }, callback);  
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
        }
      }, function () {
        if (callback) {
          callback.apply(this, arguments);
        }
      });
    }
  };

  FingerTable.prototype.updateSelfFingerTable = function (id, pos, callback) {
    if (self.parent.id <= id && id < this.fingerTable[pos]) {
      this.fingerTable[pos] = id;
      callback(true);
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
