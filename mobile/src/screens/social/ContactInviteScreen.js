import React, { useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { BrandHeader, BrandEmptyState } from '../../components/brand';
import { useTabBarInset } from '../../navigation/tabBarLayout';

export default function ContactInviteScreen({ navigation }) {
  const { colors, isDark } = useTheme();
  const tabInset = useTabBarInset(24);
  const styles = useMemo(() => ({
    flex: { flex: 1 },
    body: { flex: 1, paddingBottom: tabInset },
  }), [tabInset]);

  return (
    <LinearGradient colors={colors.bgGradient} style={styles.flex}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.flex} edges={['top']}>
        <BrandHeader title="Contacts" onBack={() => navigation.goBack()} />
        <View style={styles.body}>
          <BrandEmptyState
            icon="people-outline"
            title="Find friends"
            body="We’ll match hashed contacts to people already on MoneyBot."
          />
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
