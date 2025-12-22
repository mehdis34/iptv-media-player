import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { saveCredentials } from '@/lib/storage';
import { validateCredentials } from '@/lib/xtream';

export default function LoginScreen() {
  const router = useRouter();
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    if (!host || !username || !password) {
      setError('Veuillez remplir tous les champs.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const creds = { host, username, password };
      await validateCredentials(creds);
      await saveCredentials(creds);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-ink px-6">
      <StatusBar style="light" />
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="font-display text-5xl text-white tracking-[6px]">
            IPTV
          </Text>
          <Text className="font-body text-base text-mist">
            Connectez-vous avec vos identifiants Xtream.
          </Text>
        </View>

        <View className="gap-4">
          <View className="rounded-2xl border border-ash bg-ash/60 px-4 py-3">
            <Text className="font-body text-xs uppercase text-mist">Hôte</Text>
            <TextInput
              className="font-body text-base text-white"
              placeholder="https://example.com:8080"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              value={host}
              onChangeText={setHost}
            />
          </View>

          <View className="rounded-2xl border border-ash bg-ash/60 px-4 py-3">
            <Text className="font-body text-xs uppercase text-mist">Username</Text>
            <TextInput
              className="font-body text-base text-white"
              placeholder="Identifiant"
              placeholderTextColor="#6b7280"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View className="rounded-2xl border border-ash bg-ash/60 px-4 py-3">
            <Text className="font-body text-xs uppercase text-mist">Password</Text>
            <TextInput
              className="font-body text-base text-white"
              placeholder="Mot de passe"
              placeholderTextColor="#6b7280"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        {error ? (
          <Text className="font-body text-sm text-ember">{error}</Text>
        ) : null}

        <Pressable
          onPress={onSubmit}
          disabled={loading}
          className={`rounded-full py-4 ${loading ? 'bg-slate' : 'bg-ember'}`}>
          <Text className="text-center font-bodySemi text-base text-white">
            {loading ? 'Connexion...' : 'Entrer'}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
