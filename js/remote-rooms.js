// A missing migration leaves the fifteen existing rooms usable.
export const roomVisible = room => !!room && (!room.remote_index || room.is_active === true);
export const visibleRooms = data => data.rooms.filter(roomVisible);
export const visibleStations = data => data.stations.filter(station =>
  roomVisible(data.rooms.find(room => room.id === station.room_id)));
