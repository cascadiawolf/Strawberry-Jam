module.exports = function ({ dispatch, application }) {

  const log = (type, msg) => application.consoleMessage({ type, message: msg });

  let currentRoom = null;           // Textual room name
  let currentInternalRoomId = null;  // Numerical instance ID

  const refreshRoom = async () => {
    const textualRoom = await dispatch.getState('room');
    const internalRoomState = await dispatch.getState('internalRoomId');

    currentRoom = textualRoom;

    if (internalRoomState) {
      const parsedId = parseInt(internalRoomState, 10);
      if (!isNaN(parsedId)) {
        currentInternalRoomId = parsedId;
      } else {
        log('warn', `Phantoms: internalRoomId '${internalRoomState}' from state could not be parsed to a number.`);
        currentInternalRoomId = null;
      }
    } else {
      currentInternalRoomId = null;
    }

    if (!currentRoom && !currentInternalRoomId) {
      log('warn', 'Phantoms: No room ID is currently available from dispatch state.');
    }
  };

  // The automated packet sequence loop
  const sequenceFns = [
    r => `%xt%o%qx%${r}%%`,
    r => `%xt%o%qj%${r}%denTEST%16%1%0%`,
    r => `%xt%o%qs%${r}%dentestofpower%`,
    r => `%xt%o%qat%${r}%roomtrig_1b%0%`,
    r => `%xt%o%qpup%${r}%stone_1a_h%1017627%`,
    r => `%xt%o%qat%${r}%liza_2%0%`,
    r => `%xt%o%qaskr%${r}%liza_2%3%1%`,
    r => `%xt%o%qpup%${r}%stone_2a_h%1017627%`,
    r => `%xt%o%qat%${r}%liza_2%0%`,
    r => `%xt%o%qaskr%${r}%liza_2%3%1%`,
    r => `%xt%o%qaskr%${r}%liza_2%5%1%`,
    r => `%xt%o%qpup%${r}%stone_3a_h%1017627%`,
    r => `%xt%o%qat%${r}%liza_2%0%`,
    r => `%xt%o%qaskr%${r}%liza_2%3%1%`,
    r => `%xt%o%qaskr%${r}%liza_2%3%1%`,
    r => `%xt%o%qaskr%${r}%liza_2%7%1%`,
    r => `%xt%o%qpgift%${r}%2%0%0%`,
    r => `%xt%o%qpgift%${r}%4%0%0%`,
    r => `%xt%o%qpgift%${r}%0%0%0%`
  ];

  let interval   = null;
  let index      = 0;
  let loopActive = false;
  let sniffing   = false;

  const sendNext = async () => {
    await refreshRoom();
    const roomIdToSend = currentInternalRoomId || currentRoom;

    if (!roomIdToSend) {
      log('error', 'Phantoms: No room ID available to send packet. Stopping loop.');
      stopAll();
      return;
    }
    
    dispatch.sendRemoteMessage(sequenceFns[index](roomIdToSend));
    index = (index + 1) % sequenceFns.length;
  };

  // Filtering function to listen for items and automatically claim them
  const handleIl = async ({ message: { value } }) => {
    if (!sniffing || value.length !== 14) return;

    await refreshRoom();
    const roomIdToSend = currentInternalRoomId || currentRoom;

    if (!roomIdToSend) {
      log('error', 'Phantoms (handleIl): No room ID available to send ir packet.');
      return;
    }

    const slot = value[11];
    const id = value[12];
    
    // Ignore specific item IDs if necessary (uncomment if certain IDs crash or shouldn't be claimed)
    // if (id === '138' || id === '148' || id === '342') return;

    // Send the item reward claim packet
    dispatch.sendRemoteMessage(`%xt%o%ir%${roomIdToSend}%${slot}%`);
  };

  const startLoop = async () => {
    if (loopActive) return;
    await refreshRoom();
    const roomIdToUse = currentInternalRoomId || currentRoom;

    if (!roomIdToUse) {
      log('error', 'Phantoms: Cannot start loop, no room ID available.');
      stopAll();
      return;
    }

    index = 0;
    if (interval) dispatch.clearInterval(interval);
    interval = dispatch.setInterval(sendNext, 1500);
    loopActive = true;
  };

  const stopAll = () => {
    if (interval) dispatch.clearInterval(interval);
    interval = null;
    loopActive = sniffing = false;
  };

  dispatch.onCommand({
    name: 'thept',
    description: 'Toggle packet loop and prize claiming filtering.',
    callback: async () => {
      if (loopActive) {
        stopAll();
        log('warn', 'the phantom portal mode disabled.');
      } else {
        await startLoop();
        if (loopActive) {
          sniffing = true;
          log('success', 'the phantom portal enabled: Packet loop active and prize filtering on.');
        }
      }
    }
  });

  // Re-attached the listener to catch game events and feed them to handleIl
  dispatch.onMessage({ type: 'aj', message: 'il', callback: handleIl });
};