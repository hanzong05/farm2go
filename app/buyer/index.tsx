import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import HeaderComponent from '../../components/HeaderComponent';
import { getUserWithProfile } from '../../services/auth';
import { Database } from '../../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function BuyerDashboard() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const userData = await getUserWithProfile();
      if (userData?.profile) {
        setProfile(userData.profile);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const buyerFeatures = [
    { title: 'Browse Products', route: '/buyer/marketplace' as const, icon: '🛒', description: 'Find fresh produce from local farms' },
    { title: 'Shopping Cart', route: '/' as const, icon: '🛍️', description: 'Review items before checkout' },
    { title: 'My Orders', route: '/buyer/my-orders' as const, icon: '📋', description: 'Track your order status' },
    { title: 'Purchase History', route: '/buyer/purchase-history' as const, icon: '📋', description: 'View your past orders' },
    { title: 'Profile', route: '/buyer/settings' as const, icon: '👤', description: 'Manage your account settings' },
  ];

  const featuredProducts = [
    { name: 'Organic Tomatoes', farm: 'Green Valley Farm', price: '$4.99/lb', image: '🍅' },
    { name: 'Fresh Lettuce', farm: 'Sunny Acres', price: '$2.99/head', image: '🥬' },
    { name: 'Sweet Corn', farm: 'Harvest Moon', price: '$3.50/dozen', image: '🌽' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      <HeaderComponent
        profile={profile}
        showSearch={true}
        searchPlaceholder="Search products..."
        showAddButton={true}
        addButtonText="🛒 Browse"
        addButtonRoute="/buyer/marketplace"
        showMessages={true}
        showNotifications={true}
      />

      {/* Quick Actions */}
      <View style={{ padding: 20 }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 20
        }}>
          <Pressable style={{
            backgroundColor: '#FF5722',
            padding: 15,
            borderRadius: 10,
            flex: 1,
            marginRight: 10,
            alignItems: 'center'
          }}>
            <Text style={{
              color: 'white',
              fontSize: 14,
              fontWeight: 'bold'
            }}>
              🛒 Quick Order
            </Text>
          </Pressable>

          <Pressable style={{
            backgroundColor: '#2196F3',
            padding: 15,
            borderRadius: 10,
            flex: 1,
            marginLeft: 10,
            alignItems: 'center'
          }}>
            <Text style={{
              color: 'white',
              fontSize: 14,
              fontWeight: 'bold'
            }}>
              📍 Find Farms Near Me
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Featured Products */}
      <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 15,
          color: '#333'
        }}>
          Featured Products
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {featuredProducts.map((product, index) => (
            <View key={index} style={{
              backgroundColor: 'white',
              padding: 15,
              borderRadius: 10,
              marginRight: 15,
              width: 160,
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 40, marginBottom: 8 }}>{product.image}</Text>
              <Text style={{
                fontSize: 16,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 4
              }}>
                {product.name}
              </Text>
              <Text style={{
                fontSize: 12,
                color: '#666',
                marginBottom: 4
              }}>
                {product.farm}
              </Text>
              <Text style={{
                fontSize: 14,
                color: '#4CAF50',
                fontWeight: 'bold'
              }}>
                {product.price}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Buyer Features */}
      <View style={{ paddingHorizontal: 20 }}>
        {buyerFeatures.map((feature, index) => (
          <Link key={index} href={feature.route} asChild>
            <Pressable style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 12,
              marginBottom: 15,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}>
              <Text style={{ fontSize: 32, marginRight: 15 }}>{feature.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  color: '#333',
                  marginBottom: 4
                }}>
                  {feature.title}
                </Text>
                <Text style={{
                  fontSize: 14,
                  color: '#666'
                }}>
                  {feature.description}
                </Text>
              </View>
              <Text style={{ color: '#4CAF50', fontSize: 20 }}>→</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {/* Recent Activity */}
      <View style={{ padding: 20 }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 15,
          color: '#333'
        }}>
          Your Activity
        </Text>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }}>
          {[
            { title: 'Orders This Month', value: '5', icon: '📦' },
            { title: 'Favorites', value: '12', icon: '❤️' },
            { title: 'Money Saved', value: '$45', icon: '💰' },
            { title: 'Farms Supported', value: '8', icon: '🏡' },
          ].map((stat, index) => (
            <View key={index} style={{
              backgroundColor: 'white',
              padding: 15,
              borderRadius: 10,
              width: '48%',
              marginBottom: 10,
              alignItems: 'center'
            }}>
              <Text style={{ fontSize: 24, marginBottom: 5 }}>{stat.icon}</Text>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#4CAF50'
              }}>
                {stat.value}
              </Text>
              <Text style={{
                fontSize: 12,
                color: '#666',
                textAlign: 'center'
              }}>
                {stat.title}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}