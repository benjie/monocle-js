"use strict";

var _ = require('underscore');

// callback is a function so that it can be callable
// we add properties so we can detect that it's a monocle callback
// essentially treating the return of callback() as an instance of a
// 'Callback' class

var callback = function() {

  var cbBindObj = {
    handlers: []
  };

  // when cb is called back, it expects a node-style calling signature
  // i.e., the first parameter is the error or null, and subsequent
  // parameters are response values
  var cb = function() {
    var args = Array.prototype.slice.call(arguments, 0);
    var result;
    var err = null;
    if (args.length === 0) {
      result = null; // no values
    } else if (args.length === 1) {
      err = args[0]; // error
    } else if (args.length === 2 && args[0] === null) {
      result = args[1]; // 1 value
    } else {
      result = args.slice(1);
    }
    if (_.has(this, 'result') || _.has(this, 'error')) {
      throw new Error("Already called back");
    }
    this.result = result;
    this.error = err;

    // go through any attached handlers and pass them whatever came to us
    _.each(this.handlers, function(handler) {
      handler(err, result);
    });
  }.bind(cbBindObj);

  // 'hidden' variable used to tell monocle this is a monocle-style callback
  cb.__is_monocle_cb = true;

  cb.add = function(handler) {
    if (typeof handler !== "function") {
      throw new Error("Object " + JSON.stringify(handler) + " is not a function");
    }

    // if the callback has been called back already, pass results to handler
    // immediately
    if (_.has(this, 'error') && _.has(this, 'result')) {
      return handler(this.error, this.result);
    }
    this.handlers.push(handler);
  }.bind(cbBindObj);

  return cb;
};

module.exports = callback;
