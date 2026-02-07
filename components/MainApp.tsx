import { useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { triggerSelectionHaptic } from '../lib/haptics';
import { Session } from '@supabase/supabase-js';
import FeedScreen from './FeedScreen';
import ProfileScreen from './ProfileScreen';

type Props = {
  session: Session;
  onSignOut: () => void;
};

export default function MainApp({ session, onSignOut }: Props) {
  const { width } = useWindowDimensions();
  const currentPageRef = useRef(0);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const newPage = Math.round(offsetX / width);
    if (newPage !== currentPageRef.current) {
      currentPageRef.current = newPage;
      if (Platform.OS !== 'web') {
        triggerSelectionHaptic();
      }
    }
  };

  return (
    <ScrollView
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      bounces={false}
      onScrollEndDrag={handleScrollEnd}
      style={styles.pager}
      contentContainerStyle={styles.pagerContent}
    >
      <View style={[styles.page, { width }]}>
        <FeedScreen />
      </View>
      <View style={[styles.page, { width }]}>
        <ProfileScreen user={session.user} onSignOut={onSignOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pager: {
    flex: 1,
  },
  pagerContent: {
    flexGrow: 1,
  },
  page: {
    flex: 1,
  },
});
