import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  Check, 
  TreePine, 
  Users, 
  HardDrive, 
  Download, 
  UserPlus, 
  Shield, 
  BarChart3,
  Star,
  Clock,
  ArrowLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { useDashboardStore } from '../../store/dashboardStore';
import { navigate } from '../../utils/routing';

export const UpgradePage: React.FC = () => {
  const { setPremium } = useDashboardStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'premium'>('trial');
  const [timeLeft, setTimeLeft] = useState({
    hours: 23,
    minutes: 45,
    seconds: 12
  });
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleUpgrade = (planType: 'trial' | 'premium') => {
    setSelectedPlan(planType);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setPremium(true);
    setShowPaymentModal(false);
    // Redirect to dashboard with success message
    navigate('/dashboard?upgraded=true');
  };

  const testimonials = [
    {
      rating: 5,
      text: "Now our entire extended family is well documented. Totally worth it for $9.99/year!",
      author: "Mrs. Sari",
      family: "The Sutrisno Family",
      members: "350 members"
    },
    {
      rating: 5,
      text: "The collaboration feature lets all siblings help update data. So helpful for family reunions.",
      author: "Mr. Budi",
      family: "The Simanjuntak Clan",
      members: "180 members"
    },
    {
      rating: 5,
      text: "GEDCOM export is great for backups and sharing with other apps. Highly recommended!",
      author: "Dr. Maya",
      family: "The Handayani Family",
      members: "95 members"
    },
    {
      rating: 5,
      text: "Family analytics provides interesting insights about age and location distribution. Awesome!",
      author: "Andi Wijaya",
      family: "The Wijaya Family",
      members: "220 members"
    }
  ];

  const faqs = [
    {
      question: "🔒 Is my data safe?",
      answer: "Data is encrypted with bank-grade AES-256 standards, with automatic daily backups. We never share your personal data with third parties."
    },
    {
      question: "😞 What if I'm not satisfied?",
      answer: "We offer a 30-day no-questions-asked money-back guarantee. If you're not satisfied, contact support and you'll receive a 100% refund within 3-5 business days."
    },
    {
      question: "⬇️ Can I downgrade to a free account?",
      answer: "Yes, you can downgrade anytime. Your data stays safe, but access is limited according to the free account limits (1 family tree, 15 members). Premium features will be disabled."
    },
    {
      question: "💳 What payment methods are accepted?",
      answer: "We accept credit/debit cards (Visa, Mastercard), bank transfers, e-wallets, virtual accounts, and QR codes. Payments are securely processed by Midtrans."
    },
    {
      question: "🔄 What if I forget to renew my subscription?",
      answer: "We'll send reminders 7 days and 1 day before expiration. If you miss it, your account automatically downgrades to free without losing data. You can upgrade again anytime."
    }
  ];

  const benefits = [
    {
      icon: Users,
      title: "Extended family with 200+ members",
      description: "Document your entire extended family without member count limits",
      solution: "✅ Unlimited family members"
    },
    {
      icon: UserPlus,
      title: "Want relatives to help update data",
      description: "Invite other family members to contribute by adding and updating data",
      solution: "✅ Unlimited collaborators with permission controls"
    },
    {
      icon: HardDrive,
      title: "Lots of family photos",
      description: "Store thousands of family photos from various events and precious moments",
      solution: "✅ 10GB storage for photos and documents"
    },
    {
      icon: TreePine,
      title: "Spouse's families kept separate",
      description: "Manage the husband's and wife's family trees within a single account",
      solution: "✅ Unlimited family trees in one account"
    },
    {
      icon: BarChart3,
      title: "Want family statistics analysis",
      description: "See interesting insights about the distribution of ages, locations, and professions in your family",
      solution: "✅ Family Analytics & Insights dashboard"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <TreePine className="w-8 h-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">FamilyTree</h1>
            </div>
          </div>
          <div className="text-sm text-gray-600">
            Upgrade ke Premium
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Crown className="w-4 h-4" />
            <span>LIMITED OFFER - SAVE 50%</span>
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Document Your Entire<br />
            <span className="text-green-600">Extended Family</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Upgrade to Premium and manage unlimited family trees with unlimited family members. 
            Only <span className="font-bold text-green-600">$9.99 per year</span> 
            <span className="text-gray-500"> (less than $1 per month)</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
            <button
              onClick={() => handleUpgrade('trial')}
              className="w-full sm:w-auto bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg"
            >
              START 7-DAY FREE TRIAL
            </button>
            <button
              onClick={() => handleUpgrade('premium')}
              className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors"
            >
              UPGRADE NOW $9.99
            </button>
          </div>

          <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
            <div className="flex items-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span>No credit card required for trial</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span>30-day money-back guarantee</span>
            </div>
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-green-600" />
              <span>10,000+ families worldwide</span>
            </div>
          </div>

          {/* Countdown Timer */}
          <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-6 max-w-md mx-auto">
            <p className="text-red-800 font-medium mb-3">Offer ends in:</p>
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{timeLeft.hours.toString().padStart(2, '0')}</div>
                <div className="text-xs text-red-500">HRS</div>
              </div>
              <div className="text-red-600">:</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{timeLeft.minutes.toString().padStart(2, '0')}</div>
                <div className="text-xs text-red-500">MIN</div>
              </div>
              <div className="text-red-600">:</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{timeLeft.seconds.toString().padStart(2, '0')}</div>
                <div className="text-xs text-red-500">SEC</div>
              </div>
            </div>
          </div>
        </div>

        {/* Comparison Table */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Compare Plans
          </h2>
          
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden max-w-4xl mx-auto">
            <div className="grid grid-cols-3 gap-0">
              {/* Header */}
              <div className="p-6 bg-gray-50 border-r border-gray-200">
                <h3 className="font-semibold text-gray-900">Feature</h3>
              </div>
              <div className="p-6 bg-gray-50 border-r border-gray-200 text-center">
                <h3 className="font-semibold text-gray-900">Free</h3>
                <p className="text-sm text-gray-600 mt-1">$0/year</p>
              </div>
              <div className="p-6 bg-linear-to-r from-green-500 to-blue-500 text-center">
                <h3 className="font-semibold text-white">Premium</h3>
                <p className="text-green-100 mt-1">
                  <span className="line-through text-sm">$19.99</span> 
                  <span className="font-bold ml-2">$9.99/year</span>
                </p>
              </div>

              {/* Features */}
              {[
                { feature: 'Family Tree', free: '1', premium: 'Unlimited ✨' },
                { feature: 'Family Members', free: '15', premium: 'Unlimited 👨‍👩‍👧‍👦' },
                { feature: 'Storage', free: '500MB', premium: '10GB 📁' },
                { feature: 'Export', free: 'PDF', premium: 'PDF + Excel + GEDCOM 📊' },
                { feature: 'Collaborators', free: 'None', premium: 'Unlimited 🤝' },
                { feature: 'Automatic Backup', free: 'None', premium: 'Daily 🔄' },
                { feature: 'Support', free: 'Email', premium: 'Priority Chat 💬' },
                { feature: 'Analytics', free: 'None', premium: 'Family Insights 📈' }
              ].map((row) => (
                <React.Fragment key={row.feature}>
                  <div className="p-4 border-r border-gray-200 border-t">
                    <span className="font-medium text-gray-900">{row.feature}</span>
                  </div>
                  <div className="p-4 border-r border-gray-200 border-t text-center">
                    <span className="text-gray-600">{row.free}</span>
                  </div>
                  <div className="p-4 border-t text-center">
                    <span className="font-medium text-green-600">{row.premium}</span>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">
            Why Families Choose Premium
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12">
            Solutions for every family's needs
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit) => (
              <div key={benefit.title} className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                  <benefit.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600 mb-4">{benefit.description}</p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 font-medium text-sm">{benefit.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            What Families Say
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {testimonials.map((testimonial) => (
              <div key={testimonial.text} className="bg-white rounded-xl p-6 shadow-lg">
                <div className="flex items-center mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={`star-${testimonial.text}-${i}`} className="w-5 h-5 text-yellow-400 fill-current" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-4 italic">
                  "{testimonial.text}"
                </blockquote>
                <div className="border-t border-gray-200 pt-4">
                  <p className="font-semibold text-gray-900">{testimonial.author}</p>
                  <p className="text-sm text-gray-600">{testimonial.family}</p>
                  <p className="text-sm text-blue-600 font-medium">{testimonial.members}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Section */}
        <div className="mb-16">
          <div className="bg-linear-to-r from-green-500 to-blue-500 rounded-2xl p-8 text-white text-center">
            <h2 className="text-3xl font-bold mb-4">Limited-Time Special Price</h2>
            
            <div className="mb-6">
              <div className="text-6xl font-bold mb-2">
                <span className="line-through text-3xl opacity-75">$19.99</span>
                <span className="ml-4">$9.99</span>
              </div>
              <p className="text-xl opacity-90">per year • SAVE 50%</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 text-sm">
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold">About $1 per month</p>
                <p className="opacity-75">Cheaper than a cup of coffee</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold">About $0.03 per day</p>
                <p className="opacity-75">Cheaper than motorcycle parking</p>
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold">Free Bonus</p>
                <p className="opacity-75">7-day trial + setup assistance</p>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => handleUpgrade('trial')}
                className="w-full bg-white text-green-600 py-4 px-8 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors"
              >
                START 7-DAY FREE TRIAL - NO CREDIT CARD REQUIRED
              </button>
              <button
                onClick={() => handleUpgrade('premium')}
                className="w-full bg-yellow-400 text-gray-900 py-4 px-8 rounded-xl font-bold text-lg hover:bg-yellow-300 transition-colors"
              >
                UPGRADE NOW $9.99 - SAVE 50%
              </button>
            </div>

            <p className="text-sm opacity-75 mt-4">
              Join 10,000+ families who already trust FamilyTree
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Frequently Asked Questions
          </h2>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq) => (
              <div key={faq.question} className="bg-white rounded-xl shadow-lg overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === faq.question ? null : faq.question)}
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <h3 className="font-semibold text-gray-900">{faq.question}</h3>
                  {expandedFaq === faq.question ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {expandedFaq === faq.question && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="text-center bg-white rounded-2xl p-8 shadow-xl">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Document Your Extended Family?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Get started now and experience the ease of managing unlimited family trees
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
            <button
              onClick={() => handleUpgrade('trial')}
              className="w-full sm:w-auto bg-green-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-green-700 transition-colors"
            >
              START 7-DAY FREE TRIAL
            </button>
            <button
              onClick={() => handleUpgrade('premium')}
              className="w-full sm:w-auto bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors"
            >
              UPGRADE NOW $9.99
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
            <div className="flex items-center justify-center space-x-2">
              <Check className="w-4 h-4 text-green-600" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4 text-green-600" />
              <span>Cancel anytime</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span>Money-back guarantee</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Download className="w-4 h-4 text-green-600" />
              <span>Data is exportable</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        planType={selectedPlan}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
};