module.exports = function(RED) {


  function formatTime(t) {
    const h = Math.floor(t / 3600);
    let r = t - h * 3600;
    const m = Math.floor(r / 60);
    r -= m * 60;
    let str = '';
    if (h) {
      str = h.toString() + ':';
    }
    return `${str}${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`;
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

    const updateElapsed = () => {
      elapsed = Math.round((Date.now() - startedAt - pauseDuration - given) / 1000);
      formatted = formatTime(elapsed);
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
        timerId = setInterval(() => {
          updateElapsed();
          send({ payload: { elapsed, formatted, status } });
        }, 1000);
        status = 'running';
        this.status({ fill: 'blue', shape: 'dot', text: `${formatted}` });
      }
    };

    const pause = (send) => {
      if (status === 'running') {
        pauseStartedAt = Date.now();
        clearInterval(timerId);
        timerId = null;
        status = 'paused';
        this.status({ fill: 'yellow', shape: 'ring', text: `${formatted} (${status})` });
        send({ payload: { elapsed, formatted, status } });
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
        send({ payload: { elapsed, formatted, status } });
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