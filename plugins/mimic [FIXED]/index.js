module.exports = function ({ dispatch, application }) { // Fixed: Added application here

  let copying = false;
  let initialPlayerId = null;
  let initialMessageType = null;
  let firstPacketCaptured = false;

  /**
   * Helper function to get the current room ID dynamically 
   * to ensure outgoing chat packets are sent to the correct room.
   */
  const getCurrentRoomId = async () => {
    const internalRoom = await dispatch.getState('internalRoomId');
    const textualRoom = await dispatch.getState('room');
    return internalRoom || textualRoom || "1"; // Default fallback if state is empty
  };

  const handlePacket = async ({ message }) => {
    if (!copying) return;

    // Convert the message object safely to a string representation
    const messageContent = message.toMessage ? message.toMessage() : JSON.stringify(message);

    if (!firstPacketCaptured) {
      // Step 1: Capture your own target indicator (e.g., when you say 'mimic' in chat or initialize)
      const initialMatch = messageContent.match(/%xt%uc%\d+%(\d+)%mimic%(9|0)%0%/);
      if (initialMatch) {
        const [, playerId, type] = initialMatch;
        initialPlayerId = playerId;
        initialMessageType = type;
        firstPacketCaptured = true;
        application.consoleMessage({ message: `Mimic targeted on Player ID: ${playerId}`, type: 'success' });
      }
    } else {
      // Step 2: Dynamically fetch current room instance to build outbound packet
      const currentRoomId = await getCurrentRoomId();

      // Match Standard Messages (Type 0 or 9)
      const match = messageContent.match(/%xt%uc%\d+%(\d+)%(.+?)%(9|0)%0%/);
      if (match) {
        const [, playerId, msg, type] = match;

        // Ensure we don't mimic ourselves, only other players in the room
        if (playerId !== initialPlayerId) {
          const targetType = initialMessageType || type;
          const transformedPacket = `<msg t="sys"><body action="pubMsg" r="${currentRoomId}"><txt><![CDATA[${msg}%${targetType}]]></txt></body></msg>`;
          dispatch.sendRemoteMessage(transformedPacket);
        }
        return; // Exit early if matched
      }

      // Match Preset Quick-Text Messages (Type 1)
      const specialMatch1 = messageContent.match(/%xt%uc%\d+%(\d+)%(.+?)%1%0%/);
      if (specialMatch1) {
        const [, playerId, presetMessage] = specialMatch1;

        if (playerId !== initialPlayerId) {
          const transformedPacket = `<msg t="sys"><body action="pubMsg" r="${currentRoomId}"><txt><![CDATA[${presetMessage}%1]]></txt></body></msg>`;
          dispatch.sendRemoteMessage(transformedPacket);
        }
        return;
      }

      // Match Emotes / Actions (Type 2)
      const specialMatch2 = messageContent.match(/%xt%uc%\d+%(\d+)%(.+?)%2%0%/);
      if (specialMatch2) {
        const [, playerId, emote] = specialMatch2;

        if (playerId !== initialPlayerId) {
          const transformedPacket = `<msg t="sys"><body action="pubMsg" r="${currentRoomId}"><txt><![CDATA[${emote}%2]]></txt></body></msg>`;
          dispatch.sendRemoteMessage(transformedPacket);
        }
      }
    }
  };

  dispatch.onCommand({
    name: 'mimic',
    description: 'Mimics other player messages in the room.',
    callback: () => {
      copying = !copying;
      if (copying) {
        initialPlayerId = null;
        initialMessageType = null;
        firstPacketCaptured = false;
        application.consoleMessage({ message: 'Mimic mode enabled. Say something or trigger a target to lock in.', type: 'speech' });
      } else {
        application.consoleMessage({ message: 'Mimic mode disabled.', type: 'warn' });
      }
    }
  });

  dispatch.onMessage({
    type: '*',
    callback: handlePacket
  });
};