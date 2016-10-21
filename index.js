var Xbox = require('xbox-on');
var ping = require('ping');

var Service, Characteristic;

module.exports = function(homebridge){
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-xbox-one", "Xbox", XboxAccessory);
}

function XboxAccessory(log, config) {
  this.log = log;
  this.name = config['name'] || 'Xbox';
  this.xbox = new Xbox(config['ipAddress'], config['liveId']);
  this.tries = config['tries'] || 5;
  this.tryInterval = config['tryInterval'] || 1000;
  this.isOnline = false;
  
  var pinger = new Pinger(this.xbox.ip, 1000 * 5, function(state) {
    this.isOnline = state;
    service.getCharacteristic(Characteristic.On).getValue();
  }.bind(this), log).start();
}

XboxAccessory.prototype = {  

  setPowerState: function(powerOn, callback) {
    var self = this;
    this.log("Sending on command to '" + this.name + "'...");

    // Queue tries times at tryInterval
    for (var i = 0; i < this.tries; i++) {
      setTimeout(function() {
        self.xbox.powerOn();
      }, i * this.tryInterval);
    }

    // Don't really care about powerOn errors, and don't want more than one callback
    callback();
  },

  getPowerState: function(callback) {  
    callback(null, this.isOnline);
  },

  identify: function(callback) {
    this.log("Identify...");
    callback();
  },

  getServices: function() {
    var switchService = new Service.Switch(this.name);

    switchService
      .getCharacteristic(Characteristic.On)
      .on('set', this.setPowerState.bind(this));

    switchService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getPowerState.bind(this));

    return [switchService];
  }
};

function Pinger(ip, interval, callback, log) {
  var running = false,
    pingSession = ping.createSession(),
    pingTimer, resumeTimer;

  var log = log || function() {};


  function run() {
    if (running) {
      return;
    }

    running = true;
    pingSession.pingHost(ip, function(error) {
      callback(!error);
      running = false;
    });
  }


  return {
    start: function() {
      this.stop();
      log('Starting timer on %dms interval for %s.', interval, ip);
      pingTimer = setInterval(run, interval);
      return this;
    },

    stop: function() {
      if (pingTimer) {
        log('Stopping the current timer for %s.', ip);
        pingTimer = clearInterval(pingTimer);
      }

      return this;
    },

    suspend: function(until) {
      this.stop();

      if (resumeTimer) {
        log('Cancel currently running resume timer for %s', ip);
        resumeTimer = clearInterval(resumeTimer);
      }

      log('Setting resume timer for %s for %dms', ip, until);
      resumeTimer = setTimeout(this.start.bind(this), until);

      return this;
    }
  };
}