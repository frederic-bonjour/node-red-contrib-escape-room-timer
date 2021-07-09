module.exports = function(RED) {


  function formatTime(t) {
    const s = t % 60;
    const m = Math.floor(t / 60) % 60;
    const h = Math.floor(t / 3660);
    let str = '';
    if (h) {
      str = h.toString() + ':';
    }
    return `${str}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function EscapeRoomTimer(config) {
    RED.nodes.createNode(this, config);
    let timerId;
    let elapsed;
    let formatted;
    let startedAt = 0;
    let pauseDuration = 0;
    let pauseStartedAt = 0;
    let status = 'stopped';
    let given = 0;
    let percent = -1;

    const updateElapsed = () => {
      elapsed = Math.round((Date.now() - startedAt - pauseDuration - given) / 1000);
      if (config.mode === 'remaining' && config.duration) {
        formatted = formatTime(config.duration * 60 - elapsed);
        percent = Math.round(elapsed / (config.duration * 60) * 100);
      } else {
        formatted = formatTime(elapsed);
        percent = -1;
      }
      this.status({ fill: 'blue', shape: 'dot', text: `${formatted}` });
    };

    const start = (send) => {
      if (status === 'stopped') {
        startedAt = Date.now();
        formatted = '00:00';
        elapsed = 0;
        given = 0;
      } else if (status === 'paused') {
        pauseDuration += Date.now() - pauseStartedAt;
        pauseStartedAt = 0;
      }

      if (status === 'stopped' || status === 'paused') {
        send([
          { payload: { elapsed, formatted, percent, status } }, // first output
          { topic: status === 'stopped' ? 'started' : 'resumed' } // second output
        ]);
        timerId = setInterval(() => {
          updateElapsed();
          send([
            { payload: { elapsed, formatted, percent, status } }, // first output
            null // second output
          ]);
        }, 1000);
        status = 'running';
        this.status({ fill: 'blue', shape: 'dot', text: `${formatted}` });
      }
    };

    const reset = (send) => {
      formatted = '00:00';
      elapsed = 0;
      given = 0;
      percent = -1;
      status = 'stopped';

      send([
        { payload: { elapsed, formatted, percent, status } }, // first output
        { topic: status } // second output
      ]);
      this.status({ fill: 'blue', shape: 'dot', text: `${formatted}` });
    };

    const pause = (send) => {
      if (status === 'running') {
        pauseStartedAt = Date.now();
        clearInterval(timerId);
        timerId = null;
        status = 'paused';
        this.status({ fill: 'yellow', shape: 'ring', text: `${formatted} (${status})` });
        send([
          { payload: { elapsed, formatted, status } },
          { topic: 'paused' }
        ]);
      }
    };

    const stop = (send) => {
      if (status !== 'stopped') {
        clearInterval(timerId);
        timerId = null;
        status = 'stopped';
        pauseDuration = 0;
        pauseStartedAt = 0;
        this.status({ fill: 'grey', shape: 'ring', text: `${formatted} (${status})` });
        send([
          { payload: { elapsed, formatted, status } },
          { topic: 'stopped' }
        ]);
      }
    };

    const give = (amount) => {
      if (elapsed >= amount) {
        given += amount * 1000;
        updateElapsed();
      }
    };

    this.on('input', async (msg, send, done) => {
      switch (msg.topic) {
        case 'start':
          start(send);
          break;
        case 'pause':
          pause(send);
          break;
        case 'stop':
          stop(send);
          break;
        case 'give':
          give(msg.payload);
          break;
        case 'reset':
          stop(send);
          reset(send);
          break;
      }
    });

    this.on('close', function(done) {
      if (timerId) clearInterval(timerId);
      timerId = null;
      done();
    });
  }

  RED.nodes.registerType("room timer", EscapeRoomTimer);
}; 
