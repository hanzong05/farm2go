import { Link, router, useFocusEffect } from 'expo-router';
import { Dimensions, ScrollView, StyleSheet, Text, View, Platform } from 'react-native';
import { useEffect, useState, useCallback } from 'react';

const { width } = Dimensions.get('window');

export default function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  // Wait for component to mount before navigation
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Use useFocusEffect for safer navigation
  useFocusEffect(
    useCallback(() => {
      if (isMounted && (Platform.OS === 'ios' || Platform.OS === 'android') && !isRedirecting) {
        setIsRedirecting(true);
        // Add a small delay to ensure router is ready
        setTimeout(() => {
          router.replace('/auth/login');
        }, 100);
      }
    }, [isMounted, isRedirecting])
  );

  // If this is mobile and mounted, show loading while redirecting
  if (isMounted && (Platform.OS === 'ios' || Platform.OS === 'android')) {
    return (
      <View style={styles.mobileLoading}>
        <Text style={styles.mobileLoadingTitle}>
          🌱 Farm2Go
        </Text>
        <Text style={styles.mobileLoadingSubtitle}>
          Loading...
        </Text>
      </View>
    );
  }

  // If not mounted yet, show loading
  if (!isMounted) {
    return (
      <View style={styles.mobileLoading}>
        <Text style={styles.mobileLoadingTitle}>
          🌱 Farm2Go
        </Text>
        <Text style={styles.mobileLoadingSubtitle}>
          Loading...
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Navigation Bar */}
      <View style={styles.navbar}>
        <View style={styles.navContent}>
          <View style={styles.logo}>
            <Text style={styles.logoIcon}>🌱</Text>
            <Text style={styles.logoText}>Farm2Go</Text>
          </View>
          <View style={styles.navLinks}>
            <Link href="/about">
              <Text style={styles.navLink}>About</Text>
            </Link>
            <Link href="/features">
              <Text style={styles.navLink}>Features</Text>
            </Link>
            <Link href="/pricing">
              <Text style={styles.navLink}>Pricing</Text>
            </Link>
            <Link href="/contact">
              <Text style={styles.navLink}>Contact</Text>
            </Link>
            <Link href="/auth/login">
              <View style={styles.navButton}>
                <Text style={styles.navButtonText}>Sign In</Text>
              </View>
            </Link>
          </View>
        </View>
      </View>

      {/* Hero Section */}
      <View style={styles.hero}>
        <View style={styles.heroContent}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>🚀 Trusted by 500+ Farms Nationwide</Text>
          </View>
          
          <Text style={styles.heroTitle}>
            The Future of Agricultural{'\n'}
            <Text style={styles.heroTitleAccent}>Supply Chain Management</Text>
          </Text>
          
          <Text style={styles.heroSubtitle}>
            Enterprise-grade platform connecting agricultural producers with commercial buyers through advanced logistics and real-time market intelligence.
          </Text>

          <View style={styles.heroButtons}>
            <Link href="/auth/register" style={styles.primaryButtonLink}>
              <View style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Start Free Trial</Text>
              </View>
            </Link>
            <Link href="/demo" style={styles.secondaryButtonLink}>
              <View style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Request Demo</Text>
              </View>
            </Link>
          </View>

          {/* Metrics */}
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>$2.5M+</Text>
              <Text style={styles.metricLabel}>Transaction Volume</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>99.8%</Text>
              <Text style={styles.metricLabel}>Delivery Success</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricNumber}>24hrs</Text>
              <Text style={styles.metricLabel}>Avg. Fulfillment</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Trust Section */}
      <View style={styles.trustSection}>
        <Text style={styles.trustTitle}>Trusted by Industry Leaders</Text>
        <View style={styles.trustLogos}>
          <View style={styles.trustLogo}>
            <Text style={styles.trustLogoText}>AGRI CORP</Text>
          </View>
          <View style={styles.trustLogo}>
            <Text style={styles.trustLogoText}>HARVEST CO</Text>
          </View>
          <View style={styles.trustLogo}>
            <Text style={styles.trustLogoText}>FARM UNION</Text>
          </View>
          <View style={styles.trustLogo}>
            <Text style={styles.trustLogoText}>GREEN VALLEY</Text>
          </View>
        </View>
      </View>

      {/* Features Section */}
      <View style={styles.featuresSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionPreTitle}>PLATFORM CAPABILITIES</Text>
          <Text style={styles.sectionTitle}>Enterprise Solutions for Modern Agriculture</Text>
          <Text style={styles.sectionDescription}>
            Comprehensive suite of tools designed to optimize your agricultural supply chain operations with industry-leading efficiency.
          </Text>
        </View>

        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>📊</Text>
              </View>
            </View>
            <Text style={styles.featureTitle}>Advanced Analytics</Text>
            <Text style={styles.featureDescription}>
              Real-time market insights and predictive analytics to optimize pricing and inventory management.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🌐</Text>
              </View>
            </View>
            <Text style={styles.featureTitle}>Supply Chain Visibility</Text>
            <Text style={styles.featureDescription}>
              End-to-end traceability with GPS tracking and automated compliance reporting.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>⚡</Text>
              </View>
            </View>
            <Text style={styles.featureTitle}>Automated Operations</Text>
            <Text style={styles.featureDescription}>
              Streamline procurement processes with AI-powered matching and automated contract management.
            </Text>
          </View>

          <View style={styles.featureCard}>
            <View style={styles.featureIconContainer}>
              <View style={styles.featureIcon}>
                <Text style={styles.featureIconText}>🔒</Text>
              </View>
            </View>
            <Text style={styles.featureTitle}>Enterprise Security</Text>
            <Text style={styles.featureDescription}>
              Bank-level security with SOC 2 compliance and end-to-end encryption for all transactions.
            </Text>
          </View>
        </View>
      </View>

      {/* Solutions Section */}
      <View style={styles.solutionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionPreTitle}>TAILORED SOLUTIONS</Text>
          <Text style={styles.sectionTitle}>Built for Your Business Model</Text>
        </View>

        <View style={styles.solutionsContainer}>
          <Link href="/auth/register" style={styles.solutionCardLink}>
            <View style={styles.solutionCard}>
              <View style={styles.solutionHeader}>
                <View style={styles.solutionIcon}>
                  <Text style={styles.solutionIconText}>🏭</Text>
                </View>
                <View>
                  <Text style={styles.solutionTitle}>For Producers</Text>
                  <Text style={styles.solutionSubtitle}>Agricultural Suppliers & Cooperatives</Text>
                </View>
              </View>
              <Text style={styles.solutionDescription}>
                Maximize revenue with direct market access, automated pricing optimization, and comprehensive logistics management.
              </Text>
              <View style={styles.solutionFeatures}>
                <Text style={styles.solutionFeature}>• Market Price Intelligence</Text>
                <Text style={styles.solutionFeature}>• Quality Certification System</Text>
                <Text style={styles.solutionFeature}>• Logistics Coordination</Text>
              </View>
              <View style={styles.solutionCTA}>
                <Text style={styles.solutionCTAText}>Learn More →</Text>
              </View>
            </View>
          </Link>

          <Link href="/auth/register" style={styles.solutionCardLink}>
            <View style={styles.solutionCard}>
              <View style={styles.solutionHeader}>
                <View style={styles.solutionIcon}>
                  <Text style={styles.solutionIconText}>🏢</Text>
                </View>
                <View>
                  <Text style={styles.solutionTitle}>For Buyers</Text>
                  <Text style={styles.solutionSubtitle}>Distributors & Food Service</Text>
                </View>
              </View>
              <Text style={styles.solutionDescription}>
                Secure reliable supply chains with verified suppliers, automated procurement, and real-time inventory tracking.
              </Text>
              <View style={styles.solutionFeatures}>
                <Text style={styles.solutionFeature}>• Supplier Verification</Text>
                <Text style={styles.solutionFeature}>• Automated Procurement</Text>
                <Text style={styles.solutionFeature}>• Risk Management Tools</Text>
              </View>
              <View style={styles.solutionCTA}>
                <Text style={styles.solutionCTAText}>Learn More →</Text>
              </View>
            </View>
          </Link>
        </View>
      </View>

      
    

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerContent}>
          <View style={styles.footerTop}>
            <View style={styles.footerBrand}>
              <Text style={styles.footerLogo}>🌱 Farm2Go</Text>
              <Text style={styles.footerTagline}>
                Enterprise Agricultural Supply Chain Solutions
              </Text>
            </View>
            
            <View style={styles.footerLinks}>
              <View style={styles.footerColumn}>
                <Text style={styles.footerColumnTitle}>Platform</Text>
                <Link href="/features"><Text style={styles.footerLink}>Features</Text></Link>
                <Link href="/pricing"><Text style={styles.footerLink}>Pricing</Text></Link>
                <Link href="/integrations"><Text style={styles.footerLink}>Integrations</Text></Link>
                <Link href="/security"><Text style={styles.footerLink}>Security</Text></Link>
              </View>
              
              <View style={styles.footerColumn}>
                <Text style={styles.footerColumnTitle}>Resources</Text>
                <Link href="/docs"><Text style={styles.footerLink}>Documentation</Text></Link>
                <Link href="/support"><Text style={styles.footerLink}>Support</Text></Link>
                <Link href="/blog"><Text style={styles.footerLink}>Blog</Text></Link>
                <Link href="/case-studies"><Text style={styles.footerLink}>Case Studies</Text></Link>
              </View>
              
              <View style={styles.footerColumn}>
                <Text style={styles.footerColumnTitle}>Company</Text>
                <Link href="/about"><Text style={styles.footerLink}>About Us</Text></Link>
                <Link href="/careers"><Text style={styles.footerLink}>Careers</Text></Link>
                <Link href="/contact"><Text style={styles.footerLink}>Contact</Text></Link>
                <Link href="/press"><Text style={styles.footerLink}>Press</Text></Link>
              </View>
            </View>
          </View>
          
          <View style={styles.footerBottom}>
            <Text style={styles.footerCopyright}>
              © 2024 Farm2Go Enterprise Solutions. All rights reserved.
            </Text>
            <View style={styles.footerLegal}>
              <Link href="/terms"><Text style={styles.footerLegalLink}>Terms of Service</Text></Link>
              <Link href="/privacy"><Text style={styles.footerLegalLink}>Privacy Policy</Text></Link>
              <Link href="/cookies"><Text style={styles.footerLegalLink}>Cookie Policy</Text></Link>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Navigation
  navbar: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    fontSize: width < 768 ? 20 : 24,
    marginRight: 8,
  },
  logoText: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  navLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    display: width < 768 ? 'none' : 'flex',
  },
  navLink: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 32,
    fontWeight: '500',
  },
  navButton: {
    backgroundColor: '#111827',
    paddingHorizontal: width < 768 ? 16 : 20,
    paddingVertical: width < 768 ? 8 : 10,
    borderRadius: 8,
  },
  navButtonText: {
    color: '#ffffff',
    fontSize: width < 768 ? 14 : 16,
    fontWeight: '600',
  },

  // Hero Section
  hero: {
    backgroundColor: '#ffffff',
    paddingVertical: width < 768 ? 40 : 80,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    maxWidth: 800,
    width: '100%',
  },
  heroTitle: {
    fontSize: width < 768 ? 32 : 56,
    fontWeight: '800',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: width < 768 ? 40 : 64,
    paddingHorizontal: 8,
  },
  heroTitleAccent: {
    color: '#059669',
  },
  heroBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    marginBottom: 32,
  },
  heroBadgeText: {
    fontSize: width < 768 ? 12 : 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: width < 768 ? 16 : 20,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: width < 768 ? 24 : 32,
    fontWeight: '400',
    paddingHorizontal: 8,
  },
  heroButtons: {
    flexDirection: width < 768 ? 'column' : 'row',
    marginBottom: width < 768 ? 40 : 64,
    gap: 16,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonLink: {
    marginRight: width < 768 ? 0 : 16,
    width: width < 768 ? '100%' : 'auto',
  },
  secondaryButtonLink: {
    marginLeft: width < 768 ? 0 : 16,
    width: width < 768 ? '100%' : 'auto',
  },
  primaryButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    width: width < 768 ? '100%' : 'auto',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    width: width < 768 ? '100%' : 'auto',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: width < 768 ? 16 : 18,
    fontWeight: '600',
  },
  metricsContainer: {
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'center',
    gap: width < 768 ? 24 : 64,
    width: '100%',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricNumber: {
    fontSize: width < 768 ? 24 : 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: width < 768 ? 12 : 14,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Trust Section
  trustSection: {
    backgroundColor: '#f9fafb',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  trustTitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 32,
    textAlign: 'center',
    fontWeight: '500',
  },
  trustLogos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 40,
  },
  trustLogo: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  trustLogoText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: 'bold',
    letterSpacing: 1,
  },

  // Features Section
  featuresSection: {
    backgroundColor: '#ffffff',
    paddingVertical: width < 768 ? 48 : 96,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    marginBottom: width < 768 ? 32 : 64,
    maxWidth: 700,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  sectionPreTitle: {
    fontSize: width < 768 ? 12 : 14,
    color: '#059669',
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: width < 768 ? 24 : 40,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: width < 768 ? 32 : 48,
  },
  sectionDescription: {
    fontSize: width < 768 ? 14 : 18,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: width < 768 ? 20 : 28,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    maxWidth: 1000,
    alignSelf: 'center',
    gap: width < 768 ? 16 : 32,
  },
  featureCard: {
    width: width > 768 ? '47%' : '100%',
    backgroundColor: '#ffffff',
    padding: width < 768 ? 20 : 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  featureIconContainer: {
    marginBottom: 24,
  },
  featureIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconText: {
    fontSize: 24,
  },
  featureTitle: {
    fontSize: width < 768 ? 18 : 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  featureDescription: {
    fontSize: width < 768 ? 14 : 16,
    color: '#6b7280',
    lineHeight: width < 768 ? 20 : 24,
  },

  // Solutions Section
  solutionsSection: {
    backgroundColor: '#f9fafb',
    paddingVertical: 96,
    paddingHorizontal: 24,
  },
  solutionsContainer: {
    maxWidth: 1000,
    alignSelf: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 32,
  },
  solutionCardLink: {
    width: width > 768 ? '48%' : '100%',
  },
  solutionCard: {
    backgroundColor: '#ffffff',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    height: '100%',
  },
  solutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  solutionIcon: {
    width: 48,
    height: 48,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  solutionIconText: {
    fontSize: 20,
  },
  solutionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  solutionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  solutionDescription: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
    marginBottom: 24,
  },
  solutionFeatures: {
    marginBottom: 24,
  },
  solutionFeature: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  solutionCTA: {
    marginTop: 'auto',
  },
  solutionCTAText: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '600',
  },

  // ROI Section
  roiSection: {
    backgroundColor: '#111827',
    paddingVertical: width < 768 ? 48 : 80,
    paddingHorizontal: 16,
  },
  roiContent: {
    alignItems: 'center',
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 8,
  },
  roiTitle: {
    fontSize: width < 768 ? 28 : 40,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: width < 768 ? 36 : 48,
  },
  roiSubtitle: {
    fontSize: width < 768 ? 16 : 18,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: width < 768 ? 32 : 48,
    lineHeight: width < 768 ? 24 : 28,
  },
  roiMetrics: {
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'center',
    gap: width < 768 ? 32 : 64,
    width: '100%',
  },
  roiMetric: {
    alignItems: 'center',
    width: width < 768 ? '100%' : 'auto',
  },
  roiNumber: {
    fontSize: width < 768 ? 36 : 48,
    fontWeight: 'bold',
    color: '#10b981',
    marginBottom: 8,
  },
  roiLabel: {
    fontSize: width < 768 ? 14 : 16,
    color: '#d1d5db',
    textAlign: 'center',
  },

  // CTA Section
  ctaSection: {
    backgroundColor: '#f9fafb',
    paddingVertical: 96,
    paddingHorizontal: 24,
  },
  ctaContent: {
    alignItems: 'center',
    maxWidth: 700,
    alignSelf: 'center',
  },
  ctaTitle: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 16,
  },
  ctaDescription: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 28,
  },
  ctaButtons: {
    flexDirection: 'row',
    gap: 16,
  },

  // Footer
  footer: {
    backgroundColor: '#111827',
    paddingVertical: width < 768 ? 32 : 64,
    paddingHorizontal: 16,
  },
  footerContent: {
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  footerTop: {
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'space-between',
    marginBottom: width < 768 ? 32 : 48,
  },
  footerBrand: {
    flex: 1,
    marginRight: width < 768 ? 0 : 64,
    marginBottom: width < 768 ? 32 : 0,
  },
  footerLogo: {
    fontSize: width < 768 ? 20 : 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
  },
  footerTagline: {
    fontSize: width < 768 ? 14 : 16,
    color: '#9ca3af',
    lineHeight: width < 768 ? 20 : 24,
  },
  footerLinks: {
    flexDirection: width < 768 ? 'column' : 'row',
    gap: width < 768 ? 24 : 64,
  },
  footerColumn: {
    minWidth: 120,
  },
  footerColumnTitle: {
    fontSize: width < 768 ? 14 : 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 16,
  },
  footerLink: {
    fontSize: width < 768 ? 12 : 14,
    color: '#9ca3af',
    marginBottom: 12,
  },
  footerBottom: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    paddingTop: 32,
    flexDirection: width < 768 ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: width < 768 ? 'flex-start' : 'center',
    gap: width < 768 ? 16 : 0,
  },
  footerCopyright: {
    fontSize: width < 768 ? 12 : 14,
    color: '#9ca3af',
  },
  footerLegal: {
    flexDirection: width < 768 ? 'column' : 'row',
    gap: width < 768 ? 8 : 24,
  },
  footerLegalLink: {
    fontSize: width < 768 ? 12 : 14,
    color: '#9ca3af',
  },

  // Mobile Loading Styles
  mobileLoading: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mobileLoadingTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  mobileLoadingSubtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
});