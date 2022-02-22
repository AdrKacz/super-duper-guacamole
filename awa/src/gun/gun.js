// import "gun/lib/mobile.js" // most important!
// mobile.js content, not available in last yarn import
// ===== =====
import Buffer from 'buffer';
import {TextEncoder, TextDecoder} from 'text-encoding';
global.Buffer = global.Buffer || Buffer.Buffer;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
// ===== =====
import GUN from 'gun/gun';
// import SEA from 'gun/sea'
import 'gun/lib/radix.js';
import 'gun/lib/radisk.js';
import 'gun/lib/store.js';
import AsyncStorage from '@react-native-community/async-storage';
import asyncStore from 'gun/lib/ras.js';

GUN({store: asyncStore({AsyncStorage})});
const gun = new GUN('https://awa-gun-relay-server.herokuapp.com/gun');

export default gun;
