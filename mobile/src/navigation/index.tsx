import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { useAuthStore } from '../store/authStore';
import WeTabBar from '../components/WeTabBar';

// Screens
import HomeScreen from '../screens/HomeScreen';
import CalendarScreen from '../screens/CalendarScreen';
import TimelineScreen from '../screens/TimelineScreen';
import ShopScreen from '../screens/ShopScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HealthScreen from '../screens/HealthScreen';
import SleepTrainingScreen from '../screens/SleepTrainingScreen';
import FoodTrackerScreen from '../screens/FoodTrackerScreen';
import ChildProfileScreen from '../screens/ChildProfileScreen';
import LoginScreen from '../screens/LoginScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import InvitationScreen from '../screens/InvitationScreen';
import AlarmScreen from '../screens/AlarmScreen';
import ImportScreen from '../screens/ImportScreen';
import ShortcutsScreen from '../screens/ShortcutsScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ReviewScreen from '../screens/ReviewScreen';
import MamaHealthScreen from '../screens/MamaHealthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SkillTreeScreen from '../screens/SkillTreeScreen';
import FAQScreen from '../screens/FAQScreen';
import DailyStatsScreen from '../screens/DailyStatsScreen';
import TipsScreen from '../screens/TipsScreen';
import LegalScreen from '../screens/LegalScreen';

export type RootStackParamList = {
  Login: undefined;
  Onboarding: undefined;
  Main: undefined;
  ChildProfile: { childId: number };
  Health: undefined;
  SleepTraining: undefined;
  FoodTracker: undefined;
  Invitation: undefined;
  Alarm: undefined;
  Import: undefined;
  Shortcuts: undefined;
  Community: undefined;
  Review: undefined;
  MamaHealth: undefined;
  Dashboard: undefined;
  SkillTree: undefined;
  FAQ: undefined;
  DailyStats: undefined;
  Tips: undefined;
  Legal: undefined;
};

export type TabParamList = {
  Home: undefined;
  Calendar: undefined;
  Timeline: undefined;
  Shop: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <WeTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'ホーム' }} />
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: 'カレンダー' }} />
      <Tab.Screen name="Timeline" component={TimelineScreen} options={{ title: 'きろく' }} />
      <Tab.Screen name="Shop" component={ShopScreen} options={{ title: 'ご褒美' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="ChildProfile"
              component={ChildProfileScreen}
              options={{ headerShown: true, title: '子どもプロフィール' }}
            />
            <Stack.Screen
              name="Health"
              component={HealthScreen}
              options={{ headerShown: true, title: '健康記録' }}
            />
            <Stack.Screen
              name="SleepTraining"
              component={SleepTrainingScreen}
              options={{ headerShown: true, title: '睡眠トレーニング' }}
            />
            <Stack.Screen
              name="FoodTracker"
              component={FoodTrackerScreen}
              options={{ headerShown: true, title: '食品トラッカー' }}
            />
            <Stack.Screen
              name="Invitation"
              component={InvitationScreen}
              options={{ headerShown: true, title: 'パートナーを招待' }}
            />
            <Stack.Screen
              name="Alarm"
              component={AlarmScreen}
              options={{ headerShown: true, title: '授乳アラーム' }}
            />
            <Stack.Screen
              name="Import"
              component={ImportScreen}
              options={{ headerShown: true, title: 'ぴよログ移行' }}
            />
            <Stack.Screen
              name="Shortcuts"
              component={ShortcutsScreen}
              options={{ headerShown: true, title: '音声アシスタント連携' }}
            />
            <Stack.Screen
              name="Community"
              component={CommunityScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Review"
              component={ReviewScreen}
              options={{ headerShown: true, title: '振り返り' }}
            />
            <Stack.Screen
              name="MamaHealth"
              component={MamaHealthScreen}
              options={{ headerShown: true, title: 'ママのからだ記録' }}
            />
            <Stack.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ headerShown: true, title: 'ダッシュボード' }}
            />
            <Stack.Screen
              name="DailyStats"
              component={DailyStatsScreen}
              options={{ headerShown: true, title: 'デイリー統計' }}
            />
            <Stack.Screen
              name="Tips"
              component={TipsScreen}
              options={{ headerShown: true, title: '使い方ヒント' }}
            />
            <Stack.Screen
              name="Legal"
              component={LegalScreen}
              options={{ headerShown: true, title: 'プライバシーポリシー・利用規約' }}
            />
            <Stack.Screen
              name="SkillTree"
              component={SkillTreeScreen}
              options={{ headerShown: true, title: 'スキルツリー' }}
            />
            <Stack.Screen
              name="FAQ"
              component={FAQScreen}
              options={{ headerShown: true, title: 'よくある質問' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
