import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

export default function AdminDashboard() {
  const adminFeatures = [
    { title: 'Manage Users', route: '/admin/users' as const, icon: '👥', description: 'View and manage farmers and buyers' },
    { title: 'Manage Products', route: '/admin/products' as const, icon: '🥬', description: 'Approve and manage product listings' },
    { title: 'Manage Orders', route: '/' as const, icon: '📋', description: 'View and track all orders' },
    { title: 'Analytics', route: '/' as const, icon: '📊', description: 'View platform statistics' },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#f8f8f8' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#2E7D32',
        padding: 20,
        paddingTop: 60,
      }}>
        <Text style={{
          fontSize: 24,
          fontWeight: 'bold',
          color: 'white',
          textAlign: 'center'
        }}>
          Admin Dashboard
        </Text>
        <Text style={{
          fontSize: 16,
          color: 'white',
          textAlign: 'center',
          marginTop: 8,
          opacity: 0.9
        }}>
          Manage Farm2Go Platform
        </Text>
      </View>

      {/* Admin Features */}
      <View style={{ padding: 20 }}>
        {adminFeatures.map((feature, index) => (
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
              <Text style={{ color: '#2E7D32', fontSize: 20 }}>→</Text>
            </Pressable>
          </Link>
        ))}
      </View>

      {/* Quick Stats */}
      <View style={{ padding: 20 }}>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          marginBottom: 15,
          color: '#333'
        }}>
          Quick Stats
        </Text>
        <View style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between'
        }}>
          {[
            { title: 'Total Users', value: '1,234', icon: '👥' },
            { title: 'Active Orders', value: '56', icon: '📦' },
            { title: 'Products', value: '789', icon: '🥬' },
            { title: 'Revenue', value: '$12.5k', icon: '💰' },
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
                color: '#2E7D32'
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