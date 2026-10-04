# Whiteswan TV News Mobile App (React Native & Android APK)

A native Android & iOS mobile application for [Whiteswan TV News](https://whiteswantvnews.com/) (Malayalam News Portal) built with **React Native (Expo SDK 57)** and powered by the WordPress REST API.

---

## 📱 Features Included

- **⚡ Real-time Live Feed**: Direct integration with `https://whiteswantvnews.com/wp-json/wp/v2/`.
- **🚨 Breaking News Ticker**: Smooth animated ticker cycling breaking updates.
- **📂 Category Hub**: Deep category navigation with Malayalam titles (*രാഷ്ട്രീയം, കേരളം, സിനിമ, കായികം, ക്രൈം, പ്രവാസം, etc.*).
- **📺 Live TV & Video Streams**: In-app live broadcast player and YouTube hubs (@whiteswantvonline, @Whiteswanexclusive, @Whiteswankerala, @whiteswaninside).
- **📖 Premium Article Reader Mode**:
  - Malayalam typography scaling (`A-` / `A+` font controls)
  - Rich HTML rendering with full formatting
  - High-res image display
  - One-tap WhatsApp & social media sharing
  - Offline bookmarking
- **🔍 Instant Live Search**: Debounced search with trending Malayalam news tags.
- **🌙 Dark / Light Mode**: Seamless theme switcher matching Whiteswan TV branding.
- **💾 Offline Reading**: Persistent local bookmarks using AsyncStorage.
- **🌐 Web Extras**: In-app WebView for website features (Horoscope, Tarot, E-Paper).

---

## 🚀 How to Run Locally

### 1. Start the Development Server
```bash
npm start
```
or
```bash
npx expo start
```

### 2. Test on Your Phone
1. Install **Expo Go** from the Google Play Store (for Android) or Apple App Store (for iOS).
2. Scan the QR code displayed in your terminal using the Expo Go app (or camera on iOS).

---

## 📦 How to Build the Standalone Android APK

You can generate a standalone `.apk` file that can be shared and installed directly on any Android device without needing the Google Play Store.

### Method 1: Cloud Build via EAS (Recommended - Fast & No Setup Required)

1. **Log in to EAS** (create a free account at [expo.dev](https://expo.dev) if you don't have one):
   ```bash
   npx eas login
   ```

2. **Run the APK Build Command**:
   ```bash
   npm run build:apk
   ```
   *(or `npx eas build -p android --profile preview`)*

3. Once the build completes in the cloud (usually ~5-10 minutes), EAS will output a direct **download link for your `.apk` file**. Download it and install it on your Android phone.

---

### Method 2: Local APK Build (Requires Android SDK & Java JDK)

If you have Android Studio / Android SDK and Java JDK installed on your machine:

```bash
npx expo run:android --variant release
```

---

## 📂 Project Structure

```
├── App.js                      # Root entry point with Providers
├── app.json                    # App config, permissions, icons & package ID
├── eas.json                    # EAS configuration for direct APK builds
├── package.json
└── src/
    ├── components/
    │   ├── BreakingNewsTicker.js # Animated breaking news ticker
    │   ├── CategoryPills.js      # Horizontal category pills
    │   ├── EmptyState.js         # Malayalam empty/error state
    │   ├── Header.js             # Brand top bar with Live TV & theme toggle
    │   ├── LoadingSkeleton.js    # Shimmer loading animations
    │   ├── NewsCard.js           # Hero, Compact and Grid news cards
    │   └── VideoCard.js          # Live & YouTube video channel card
    ├── constants/
    │   ├── categories.js         # Category mappings & social links
    │   ├── channels.js           # YouTube & Live stream configurations
    │   └── theme.js              # Dark/Light colors & typography tokens
    ├── context/
    │   ├── BookmarkContext.js    # Offline saved articles provider
    │   └── ThemeContext.js       # Light/Dark mode provider
    ├── navigation/
    │   └── AppNavigator.js       # Bottom Tabs & Native Stack Navigator
    ├── screens/
    │   ├── ArticleDetailScreen.js # Full article reader & social share
    │   ├── BookmarksScreen.js    # Saved offline news list
    │   ├── CategoryScreen.js     # Category explorer feed
    │   ├── HomeScreen.js         # Main home feed & hero slider
    │   ├── LiveTVScreen.js       # Live stream player & channels
    │   ├── LoginScreen.js        # WordPress & App Sign In
    │   ├── RegisterScreen.js     # Account registration
    │   ├── ProfileScreen.js      # User account & settings
    │   ├── PremiumPlansScreen.js # VIP membership plans & checkout
    │   ├── SearchScreen.js       # Live search & trending topics
    │   └── WebExtrasScreen.js    # In-app WebView for special site features
    └── services/
        └── wpApi.js              # WordPress REST API client & parser
```
