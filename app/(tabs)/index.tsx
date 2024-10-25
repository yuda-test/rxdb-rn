import { Image, StyleSheet, Platform } from 'react-native';

import { HelloWave } from '@/components/HelloWave';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';

import { signIn, signUp } from 'aws-amplify/auth';
import { Amplify } from 'aws-amplify';
import amplifyConfig from '../amplifyconfiguration.json';
import { useEffect } from 'react';
Amplify.configure(amplifyConfig);

export default function HomeScreen() {

  const username = 'yuda';
  const password = 'Yud@123456';

  useEffect(() => {
    console.log('username => ', username);
    console.log('password => ', password);
    // signUp({
    //   username,
    //   password,
    //   options: {
    //     userAttributes: {
    //       name: 'yuda'
    //     }
    //   }
    // })
    //   .then(v => console.log(v))
    //   .catch(e => console.log('error => ', e.message));
    signIn({ username, password })
      .then(({ isSignedIn, nextStep }) => {
        console.log('isSigned => ', isSignedIn);
        console.log('nextStep => ', nextStep);
      })
      .catch(e => console.log('error => ', e.underlyingError));

  }, []);

  return (
    // <ParallaxScrollView
    //   headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
    //   headerImage={
    //     <Image
    //       source={require('@/assets/images/partial-react-logo.png')}
    //       style={styles.reactLogo}
    //     />
    //   }
    // >
    <ThemedView style={styles.titleContainer}>
      <ThemedText type="title">Welcome!</ThemedText>
      {/* <HelloWave /> */}
    </ThemedView>
    // </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: 'absolute',
  },
});
