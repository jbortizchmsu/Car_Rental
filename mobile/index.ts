// Registers the background GPS task before anything else runs — including the case
// where the OS restarts the app process specifically to redeliver a location update
// to an already-started background task. Must be imported first.
import './src/services/backgroundLocation';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
