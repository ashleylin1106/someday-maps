import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from './src/store';
import { HomeScreen } from './src/HomeScreen';

export default function App() {
  return (
    <StoreProvider>
      <StatusBar style="dark" />
      <HomeScreen />
    </StoreProvider>
  );
}
