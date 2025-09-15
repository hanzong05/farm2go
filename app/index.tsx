import { StyleSheet, ScrollView, View, Text, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function LandingPage() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.title}>Farm2Go</Text>
        <Text style={styles.subtitle}>Connecting Farmers Directly to Buyers</Text>
        <Text style={styles.description}>
          Fresh produce from local farms delivered straight to your door
        </Text>
      </View>

      <View style={styles.features}>
        <Text style={styles.sectionTitle}>What We Offer</Text>

        <View style={styles.feature}>
          <Text style={styles.featureTitle}>🌱 Fresh Local Produce</Text>
          <Text style={styles.featureText}>Direct from farmers to your table</Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureTitle}>📍 GPS Location Services</Text>
          <Text style={styles.featureText}>Find farms and pickup points near you</Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureTitle}>🤝 Partnership with Cooperatives</Text>
          <Text style={styles.featureText}>Supporting local farming communities</Text>
        </View>

        <View style={styles.feature}>
          <Text style={styles.featureTitle}>📱 Visual Product Search</Text>
          <Text style={styles.featureText}>Take a photo to find similar products</Text>
        </View>
      </View>

      <View style={styles.userTypes}>
        <Text style={styles.sectionTitle}>Join Our Community</Text>

        <Link href="/auth/register" style={styles.userCard}>
          <View style={styles.userCardContent}>
            <Text style={styles.userTitle}>🌾 I'm a Farmer</Text>
            <Text style={styles.userText}>Sell your produce directly to buyers</Text>
          </View>
        </Link>

        <Link href="/auth/register" style={styles.userCard}>
          <View style={styles.userCardContent}>
            <Text style={styles.userTitle}>🛒 I'm a Buyer</Text>
            <Text style={styles.userText}>Get fresh produce from local farms</Text>
          </View>
        </Link>

        <Link href="/auth/login" style={styles.loginButton}>
          <Text style={styles.loginText}>Already have an account? Sign In</Text>
        </Link>
      </View>

      <View style={styles.footer}>
        <Link href="/about"><Text style={styles.footerLink}>About</Text></Link>
        <Link href="/contact"><Text style={styles.footerLink}>Contact</Text></Link>
        <Link href="/terms"><Text style={styles.footerLink}>Terms</Text></Link>
        <Link href="/privacy"><Text style={styles.footerLink}>Privacy</Text></Link>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  hero: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#4CAF50',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    opacity: 0.9,
  },
  features: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  feature: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featureText: {
    fontSize: 14,
    color: '#666',
  },
  userTypes: {
    padding: 20,
  },
  userCard: {
    marginBottom: 15,
    padding: 20,
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  userCardContent: {
    alignItems: 'center',
  },
  userTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  userText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loginButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    alignItems: 'center',
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    marginTop: 20,
  },
  footerLink: {
    color: '#2196F3',
    fontSize: 14,
  },
});