import { useCallback, useEffect, useRef, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Restaurant } from '../types';
import { colors } from '../constants/theme';
import { fetchRestaurants, recordInteraction } from '../lib/restaurants';

function getMapsUrl(placeId: string): string {
  return `https://www.google.com/maps/search/?api=1&query_place_id=${placeId}`;
}

function ActionBar({
  onLike,
  onUnlike,
  onShare,
}: {
  onLike: () => void;
  onUnlike: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [liked, setLiked] = useState(false);

  const handleToggleLike = useCallback(() => {
    if (liked) {
      setLiked(false);
      onUnlike();
    } else {
      setLiked(true);
      onLike();
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.4,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1.15,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [liked, onLike, onUnlike, scaleAnim]);

  return (
    <View style={[styles.actionBar, { bottom: insets.bottom + 120 }]}>
      <TouchableOpacity style={styles.actionButton} onPress={handleToggleLike}>
        <Animated.Text
          style={[
            styles.actionIcon,
            styles.heartIcon,
            liked && styles.heartIconLiked,
            { transform: [{ scale: scaleAnim }] },
          ]}
        >
          ♥
        </Animated.Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={onShare}>
        <Feather name="corner-up-right" size={36} color={colors.text} style={styles.shareIcon} />
      </TouchableOpacity>
    </View>
  );
}

function RestaurantCard({
  restaurant,
  onLike,
  onUnlike,
  onShare,
}: {
  restaurant: Restaurant;
  onLike: () => void;
  onUnlike: () => void;
  onShare: () => void;
}) {
  const { height } = useWindowDimensions();
  const cuisine =
    restaurant.cuisine?.replace(/_/g, ' ') ?? 'Restaurant';

  return (
    <View style={[styles.card, { height }]}>
      <View style={styles.cardContent}>
        <Text style={styles.restaurantName}>{restaurant.name}</Text>
        <Text style={styles.cuisine}>{cuisine}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>★ {restaurant.rating?.toFixed(1) ?? '—'}</Text>
        </View>
        <Text style={styles.address}>{restaurant.address}</Text>
      </View>
      <ActionBar onLike={onLike} onUnlike={onUnlike} onShare={onShare} />
    </View>
  );
}

export default function FeedScreen() {
  const { height } = useWindowDimensions();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const viewStartRef = useRef<number>(Date.now());
  const currentIndexRef = useRef(0);

  const loadRestaurants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission is required to find nearby restaurants.');
        setRestaurants([]);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      const data = await fetchRestaurants(latitude, longitude);
      setRestaurants(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load restaurants');
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRestaurants();
  }, [loadRestaurants]);

  const recordViewEnd = useCallback(
    (index: number, action: 'like' | 'skip' | 'unlike') => {
      const restaurant = restaurants[index];
      if (!restaurant) return;
      const timeSpentMs = Date.now() - viewStartRef.current;
      recordInteraction(restaurant.id, action, timeSpentMs);
    },
    [restaurants]
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index: number | null }[] }) => {
      const visible = viewableItems[0];
      if (visible?.index == null) return;
      const newIndex = visible.index;
      const prevIndex = currentIndexRef.current;
      if (prevIndex !== newIndex) {
        recordViewEnd(prevIndex, 'skip');
        currentIndexRef.current = newIndex;
        viewStartRef.current = Date.now();
      }
    },
    [recordViewEnd]
  );

  const handleLike = useCallback(
    (index: number) => {
      recordViewEnd(index, 'like');
      viewStartRef.current = Date.now();
    },
    [recordViewEnd]
  );

  const handleUnlike = useCallback(
    (index: number) => {
      recordViewEnd(index, 'unlike');
      viewStartRef.current = Date.now();
    },
    [recordViewEnd]
  );

  const handleShare = useCallback((restaurant: Restaurant) => {
    const url = getMapsUrl(restaurant.id);
    Share.share({
      message: `Check out ${restaurant.name}!\n${url}`,
      url: url,
      title: restaurant.name,
    });
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Restaurant; index: number }) => (
      <RestaurantCard
        restaurant={item}
        onLike={() => handleLike(index)}
        onUnlike={() => handleUnlike(index)}
        onShare={() => handleShare(item)}
      />
    ),
    [handleLike, handleUnlike, handleShare]
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height]
  );

  const viewabilityConfig = useRef({
    viewAreaCoveragePercentThreshold: 80,
    minimumViewTime: 100,
  }).current;

  if (loading && restaurants.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Finding restaurants near you...</Text>
      </View>
    );
  }

  if (error && restaurants.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.retryText} onPress={loadRestaurants}>
          Retry
        </Text>
      </View>
    );
  }

  if (restaurants.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No restaurants found nearby.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={restaurants}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        getItemLayout={getItemLayout}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        pagingEnabled
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.textDim,
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: colors.textMuted,
    textAlign: 'center',
    fontSize: 16,
  },
  retryText: {
    color: colors.accent,
    marginTop: 16,
    fontSize: 16,
  },
  card: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceSecondary,
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  restaurantName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  cuisine: {
    fontSize: 18,
    color: colors.textMuted,
    marginBottom: 16,
  },
  ratingContainer: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 16,
  },
  rating: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accentText,
  },
  address: {
    fontSize: 16,
    color: colors.textDim,
  },
  actionBar: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
    gap: 28,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 40,
    marginBottom: 6,
  },
  heartIcon: {
    color: colors.textMuted,
  },
  heartIconLiked: {
    color: '#e74c3c',
  },
  shareIcon: {
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
