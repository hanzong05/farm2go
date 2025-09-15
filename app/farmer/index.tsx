import { View, Text, Pressable, ScrollView } from 'react-native';
import { Link } from 'expo-router';

export default function FarmerDashboard() {
  const farmerFeatures = [
    { title: 'My Products', route: '/farmer/my-products' as const, icon: '🥬', description: 'Manage your product listings' },
    { title: 'Orders', route: '/farmer/orders' as const, icon: '📋', description: 'View and fulfill customer orders' },
    { title: 'Inventory', route: '/farmer/inventory' as const, icon: '📦', description: 'Manage your stock levels' },
    { title: 'Farm Profile', route: '/farmer/settings' as const, icon: '🏡', description: 'Update your farm information' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#4CAF50',
        padding: 20,
        paddingTop: 60,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: 'white',
          textAlign: 'center'
        }}>
          Welcome Back, John! 👨‍🌾
        </Text>
        <Text style={{
          fontSize: 16,
          color: 'white',
          textAlign: 'center',
          marginTop: 8,
          opacity: 0.9
        }}>
          Green Valley Farm
        </Text>
      </View>

      {/* Quick Actions */}
      <View style={{ padding: 20 }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 15,
          color: '#333'
        }}>
          Quick Actions
        </Text>

        <Pressable style={{
          backgroundColor: '#4CAF50',
          padding: 15,
          borderRadius: 10,
          marginBottom: 20,
          alignItems: 'center'
        }}>
          <Text style={{
            color: 'white',
            fontSize: 16,
            fontWeight: 'bold'
          }}>
            📸 Add New Product
          </Text>
        </Pressable>
      </View>

      {/* Farmer Features */}
      <View style={{ paddingHorizontal: 20 }}>
        {farmerFeatures.map((feature, index) => (
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

      {/* Farm Stats */}
      <View style={{ padding: 20 }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 15,
          color: '#333'
        }}>
          Your Farm Stats
        </Text>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }}>
          {[
            { title: 'Products Listed', value: '23', icon: '🥬' },
            { title: 'Orders Today', value: '8', icon: '📦' },
            { title: 'Total Sales', value: '$1,240', icon: '💰' },
            { title: 'Rating', value: '4.8⭐', icon: '⭐' },
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