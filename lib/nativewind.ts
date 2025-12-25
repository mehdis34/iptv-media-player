import { cssInterop } from 'nativewind';
import { LinearGradient } from 'expo-linear-gradient';

// Allow className on third-party components.
cssInterop(LinearGradient, { className: 'style' });
