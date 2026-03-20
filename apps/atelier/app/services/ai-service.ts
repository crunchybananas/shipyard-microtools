import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type DesignStoreService from "./design-store";
import type { DesignElement } from "./design-store";

interface AiTemplate {
  name: string;
  elements: Partial<DesignElement>[];
}

const TEMPLATES: Record<string, AiTemplate> = {
  "landing page": {
    name: "Landing Page",
    elements: [
      // Hero section background
      { type: "frame", x: 0, y: 0, width: 1440, height: 800, fill: "#0f0f23", stroke: "transparent", name: "Hero Section", cornerRadius: 0 },
      // Nav bar
      { type: "rectangle", x: 0, y: 0, width: 1440, height: 72, fill: "#1a1a36", stroke: "transparent", name: "Nav Bar", opacity: 0.95 },
      { type: "text", x: 40, y: 18, width: 200, height: 36, text: "Atelier", fontSize: 28, fontWeight: "700", fill: "#818cf8", name: "Logo" },
      { type: "text", x: 800, y: 24, width: 80, height: 24, text: "Features", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 1" },
      { type: "text", x: 920, y: 24, width: 80, height: 24, text: "Pricing", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 2" },
      { type: "text", x: 1040, y: 24, width: 80, height: 24, text: "Docs", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 3" },
      { type: "rectangle", x: 1280, y: 16, width: 120, height: 40, fill: "#818cf8", cornerRadius: 8, name: "CTA Nav Button" },
      { type: "text", x: 1303, y: 22, width: 80, height: 24, text: "Sign Up", fontSize: 15, fontWeight: "600", fill: "#ffffff", name: "CTA Nav Text" },
      // Hero content
      { type: "rectangle", x: 620, y: 120, width: 200, height: 32, fill: "#2a2a4a", cornerRadius: 16, name: "Badge" },
      { type: "text", x: 640, y: 124, width: 180, height: 24, text: "Now in Public Beta", fontSize: 14, fontWeight: "500", fill: "#a78bfa", name: "Badge Text" },
      { type: "text", x: 260, y: 180, width: 920, height: 80, text: "Design at the speed", fontSize: 72, fontWeight: "800", fill: "#ffffff", name: "Hero Title L1" },
      { type: "text", x: 390, y: 270, width: 660, height: 80, text: "of thought", fontSize: 72, fontWeight: "800", fill: "#818cf8", name: "Hero Title L2" },
      { type: "text", x: 360, y: 370, width: 720, height: 56, text: "The AI-native design tool that turns your ideas into", fontSize: 20, fontWeight: "400", fill: "#a1a1aa", name: "Subtitle L1" },
      { type: "text", x: 400, y: 400, width: 640, height: 56, text: "polished interfaces in seconds, not hours.", fontSize: 20, fontWeight: "400", fill: "#a1a1aa", name: "Subtitle L2" },
      // CTA buttons
      { type: "rectangle", x: 520, y: 470, width: 200, height: 52, fill: "#818cf8", cornerRadius: 12, name: "Primary CTA" },
      { type: "text", x: 555, y: 480, width: 140, height: 32, text: "Get Started", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Primary CTA Text" },
      { type: "rectangle", x: 740, y: 470, width: 200, height: 52, fill: "transparent", stroke: "#52525b", strokeWidth: 2, cornerRadius: 12, name: "Secondary CTA" },
      { type: "text", x: 770, y: 480, width: 160, height: 32, text: "Watch Demo", fontSize: 18, fontWeight: "600", fill: "#e4e4e7", name: "Secondary CTA Text" },
      // Floating preview card
      { type: "rectangle", x: 320, y: 560, width: 800, height: 220, fill: "#1e1e3a", cornerRadius: 16, stroke: "#2a2a4a", strokeWidth: 1, name: "Preview Card" },
      { type: "rectangle", x: 340, y: 580, width: 360, height: 180, fill: "#252545", cornerRadius: 8, name: "Preview Left" },
      { type: "rectangle", x: 720, y: 580, width: 380, height: 80, fill: "#252545", cornerRadius: 8, name: "Preview Right Top" },
      { type: "rectangle", x: 720, y: 680, width: 380, height: 80, fill: "#252545", cornerRadius: 8, name: "Preview Right Bottom" },
      // Stats row
      { type: "rectangle", x: 0, y: 800, width: 1440, height: 120, fill: "#141428", name: "Stats Bar" },
      { type: "text", x: 180, y: 830, width: 120, height: 40, text: "10k+", fontSize: 36, fontWeight: "700", fill: "#818cf8", name: "Stat 1 Number" },
      { type: "text", x: 180, y: 870, width: 120, height: 24, text: "Designers", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 1 Label" },
      { type: "text", x: 540, y: 830, width: 120, height: 40, text: "50M+", fontSize: 36, fontWeight: "700", fill: "#818cf8", name: "Stat 2 Number" },
      { type: "text", x: 530, y: 870, width: 140, height: 24, text: "Designs Created", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 2 Label" },
      { type: "text", x: 900, y: 830, width: 120, height: 40, text: "99.9%", fontSize: 36, fontWeight: "700", fill: "#818cf8", name: "Stat 3 Number" },
      { type: "text", x: 910, y: 870, width: 120, height: 24, text: "Uptime", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 3 Label" },
      { type: "text", x: 1200, y: 830, width: 120, height: 40, text: "4.9", fontSize: 36, fontWeight: "700", fill: "#818cf8", name: "Stat 4 Number" },
      { type: "text", x: 1200, y: 870, width: 120, height: 24, text: "Rating", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 4 Label" },
      // Features section
      { type: "frame", x: 0, y: 920, width: 1440, height: 600, fill: "#0f0f23", stroke: "transparent", name: "Features Section", cornerRadius: 0 },
      { type: "text", x: 480, y: 960, width: 480, height: 48, text: "Powerful Features", fontSize: 42, fontWeight: "700", fill: "#ffffff", name: "Features Title" },
      { type: "text", x: 400, y: 1020, width: 640, height: 32, text: "Everything you need to bring your designs to life", fontSize: 18, fontWeight: "400", fill: "#71717a", name: "Features Subtitle" },
      // Feature cards
      { type: "rectangle", x: 80, y: 1080, width: 400, height: 280, fill: "#1a1a36", cornerRadius: 16, stroke: "#2a2a4a", strokeWidth: 1, name: "Feature Card 1" },
      { type: "ellipse", x: 110, y: 1110, width: 48, height: 48, fill: "#312e81", name: "Feature Icon 1" },
      { type: "text", x: 110, y: 1180, width: 340, height: 32, text: "AI-Powered Design", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 1 Title" },
      { type: "text", x: 110, y: 1220, width: 340, height: 60, text: "Describe your vision and watch it come to life with intelligent layout generation.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 1 Desc" },
      { type: "rectangle", x: 520, y: 1080, width: 400, height: 280, fill: "#1a1a36", cornerRadius: 16, stroke: "#2a2a4a", strokeWidth: 1, name: "Feature Card 2" },
      { type: "ellipse", x: 550, y: 1110, width: 48, height: 48, fill: "#1e3a5f", name: "Feature Icon 2" },
      { type: "text", x: 550, y: 1180, width: 340, height: 32, text: "Real-time Collaboration", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 2 Title" },
      { type: "text", x: 550, y: 1220, width: 340, height: 60, text: "Work together with your team in real-time with multiplayer cursors and comments.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 2 Desc" },
      { type: "rectangle", x: 960, y: 1080, width: 400, height: 280, fill: "#1a1a36", cornerRadius: 16, stroke: "#2a2a4a", strokeWidth: 1, name: "Feature Card 3" },
      { type: "ellipse", x: 990, y: 1110, width: 48, height: 48, fill: "#1e3a3a", name: "Feature Icon 3" },
      { type: "text", x: 990, y: 1180, width: 340, height: 32, text: "Design Systems", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 3 Title" },
      { type: "text", x: 990, y: 1220, width: 340, height: 60, text: "Build and maintain consistent design systems with tokens, components, and variants.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 3 Desc" },
    ],
  },
  "mobile app": {
    name: "Mobile App",
    elements: [
      // Phone frame
      { type: "rectangle", x: 520, y: 40, width: 390, height: 844, fill: "#0f0f23", cornerRadius: 44, stroke: "#2a2a4a", strokeWidth: 2, name: "Phone Frame" },
      // Status bar
      { type: "text", x: 556, y: 60, width: 60, height: 20, text: "9:41", fontSize: 15, fontWeight: "600", fill: "#ffffff", name: "Time" },
      { type: "rectangle", x: 640, y: 56, width: 150, height: 28, fill: "#1a1a2e", cornerRadius: 14, name: "Dynamic Island" },
      // Header
      { type: "text", x: 556, y: 110, width: 260, height: 36, text: "Good morning", fontSize: 16, fontWeight: "400", fill: "#71717a", name: "Greeting" },
      { type: "text", x: 556, y: 140, width: 280, height: 40, text: "Alex Chen", fontSize: 28, fontWeight: "700", fill: "#ffffff", name: "User Name" },
      { type: "ellipse", x: 852, y: 110, width: 44, height: 44, fill: "#818cf8", name: "Avatar" },
      // Search bar
      { type: "rectangle", x: 546, y: 190, width: 338, height: 48, fill: "#1a1a36", cornerRadius: 12, name: "Search Bar" },
      { type: "text", x: 580, y: 200, width: 200, height: 28, text: "Search...", fontSize: 16, fontWeight: "400", fill: "#52525b", name: "Search Placeholder" },
      // Quick actions
      { type: "rectangle", x: 546, y: 260, width: 76, height: 76, fill: "#312e81", cornerRadius: 20, name: "Action 1" },
      { type: "text", x: 556, y: 345, width: 56, height: 16, text: "Wallet", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 1 Label" },
      { type: "rectangle", x: 634, y: 260, width: 76, height: 76, fill: "#1e3a5f", cornerRadius: 20, name: "Action 2" },
      { type: "text", x: 641, y: 345, width: 62, height: 16, text: "Transfer", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 2 Label" },
      { type: "rectangle", x: 722, y: 260, width: 76, height: 76, fill: "#1e3a3a", cornerRadius: 20, name: "Action 3" },
      { type: "text", x: 734, y: 345, width: 52, height: 16, text: "Cards", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 3 Label" },
      { type: "rectangle", x: 810, y: 260, width: 76, height: 76, fill: "#3a1e3a", cornerRadius: 20, name: "Action 4" },
      { type: "text", x: 823, y: 345, width: 50, height: 16, text: "More", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 4 Label" },
      // Balance card
      { type: "rectangle", x: 546, y: 380, width: 338, height: 160, fill: "#818cf8", cornerRadius: 20, name: "Balance Card" },
      { type: "text", x: 572, y: 400, width: 200, height: 24, text: "Total Balance", fontSize: 14, fontWeight: "500", fill: "rgba(255,255,255,0.7)", name: "Balance Label" },
      { type: "text", x: 572, y: 430, width: 240, height: 48, text: "$12,580.00", fontSize: 36, fontWeight: "700", fill: "#ffffff", name: "Balance Amount" },
      { type: "text", x: 572, y: 490, width: 140, height: 20, text: "+2.5% this month", fontSize: 14, fontWeight: "500", fill: "rgba(255,255,255,0.8)", name: "Balance Change" },
      // Transactions header
      { type: "text", x: 556, y: 570, width: 200, height: 28, text: "Recent Activity", fontSize: 20, fontWeight: "600", fill: "#ffffff", name: "Activity Header" },
      { type: "text", x: 822, y: 574, width: 60, height: 20, text: "See all", fontSize: 14, fontWeight: "500", fill: "#818cf8", name: "See All" },
      // Transaction items
      { type: "rectangle", x: 546, y: 610, width: 338, height: 64, fill: "#1a1a36", cornerRadius: 12, name: "Transaction 1" },
      { type: "ellipse", x: 562, y: 622, width: 40, height: 40, fill: "#312e81", name: "Tx Icon 1" },
      { type: "text", x: 614, y: 620, width: 160, height: 20, text: "Apple Store", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 1 Name" },
      { type: "text", x: 614, y: 644, width: 120, height: 18, text: "Mar 15, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 1 Date" },
      { type: "text", x: 820, y: 630, width: 60, height: 20, text: "-$29.99", fontSize: 15, fontWeight: "600", fill: "#f87171", name: "Tx 1 Amount" },
      { type: "rectangle", x: 546, y: 686, width: 338, height: 64, fill: "#1a1a36", cornerRadius: 12, name: "Transaction 2" },
      { type: "ellipse", x: 562, y: 698, width: 40, height: 40, fill: "#1e3a3a", name: "Tx Icon 2" },
      { type: "text", x: 614, y: 696, width: 160, height: 20, text: "Salary Deposit", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 2 Name" },
      { type: "text", x: 614, y: 720, width: 120, height: 18, text: "Mar 14, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 2 Date" },
      { type: "text", x: 804, y: 706, width: 80, height: 20, text: "+$4,200", fontSize: 15, fontWeight: "600", fill: "#4ade80", name: "Tx 2 Amount" },
      { type: "rectangle", x: 546, y: 762, width: 338, height: 64, fill: "#1a1a36", cornerRadius: 12, name: "Transaction 3" },
      { type: "ellipse", x: 562, y: 774, width: 40, height: 40, fill: "#3a1e3a", name: "Tx Icon 3" },
      { type: "text", x: 614, y: 772, width: 160, height: 20, text: "Netflix", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 3 Name" },
      { type: "text", x: 614, y: 796, width: 120, height: 18, text: "Mar 13, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 3 Date" },
      { type: "text", x: 820, y: 782, width: 60, height: 20, text: "-$15.99", fontSize: 15, fontWeight: "600", fill: "#f87171", name: "Tx 3 Amount" },
      // Bottom nav
      { type: "rectangle", x: 520, y: 840, width: 390, height: 44, fill: "#0f0f23", cornerRadius: 0, name: "Bottom Nav BG" },
      { type: "ellipse", x: 570, y: 846, width: 28, height: 28, fill: "#818cf8", name: "Nav Home" },
      { type: "ellipse", x: 660, y: 846, width: 28, height: 28, fill: "#2a2a4a", name: "Nav Stats" },
      { type: "ellipse", x: 750, y: 846, width: 28, height: 28, fill: "#2a2a4a", name: "Nav Cards" },
      { type: "ellipse", x: 840, y: 846, width: 28, height: 28, fill: "#2a2a4a", name: "Nav Profile" },
    ],
  },
  "dashboard": {
    name: "Dashboard",
    elements: [
      // Sidebar
      { type: "rectangle", x: 0, y: 0, width: 240, height: 900, fill: "#111127", stroke: "transparent", name: "Sidebar" },
      { type: "text", x: 24, y: 24, width: 160, height: 32, text: "Analytics", fontSize: 22, fontWeight: "700", fill: "#818cf8", name: "App Name" },
      // Sidebar nav items
      { type: "rectangle", x: 12, y: 80, width: 216, height: 40, fill: "#1e1e3a", cornerRadius: 8, name: "Nav Active" },
      { type: "text", x: 48, y: 88, width: 140, height: 24, text: "Dashboard", fontSize: 14, fontWeight: "600", fill: "#ffffff", name: "Nav 1" },
      { type: "text", x: 48, y: 136, width: 140, height: 24, text: "Analytics", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 2" },
      { type: "text", x: 48, y: 172, width: 140, height: 24, text: "Customers", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 3" },
      { type: "text", x: 48, y: 208, width: 140, height: 24, text: "Products", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 4" },
      { type: "text", x: 48, y: 244, width: 140, height: 24, text: "Orders", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 5" },
      { type: "text", x: 48, y: 280, width: 140, height: 24, text: "Settings", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 6" },
      // Main content area
      { type: "frame", x: 240, y: 0, width: 1200, height: 900, fill: "#0f0f23", stroke: "transparent", name: "Main Content", cornerRadius: 0 },
      // Top bar
      { type: "text", x: 280, y: 28, width: 200, height: 32, text: "Dashboard", fontSize: 24, fontWeight: "600", fill: "#ffffff", name: "Page Title" },
      { type: "rectangle", x: 1240, y: 20, width: 160, height: 40, fill: "#818cf8", cornerRadius: 8, name: "Action Button" },
      { type: "text", x: 1260, y: 28, width: 120, height: 24, text: "Export Report", fontSize: 14, fontWeight: "600", fill: "#ffffff", name: "Action Text" },
      // Stat cards row
      { type: "rectangle", x: 280, y: 80, width: 270, height: 120, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Stat Card 1" },
      { type: "text", x: 304, y: 100, width: 200, height: 20, text: "Total Revenue", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 1 Label" },
      { type: "text", x: 304, y: 128, width: 200, height: 36, text: "$45,231", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 1 Value" },
      { type: "text", x: 304, y: 168, width: 140, height: 18, text: "+20.1% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 1 Change" },
      { type: "rectangle", x: 566, y: 80, width: 270, height: 120, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Stat Card 2" },
      { type: "text", x: 590, y: 100, width: 200, height: 20, text: "Active Users", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 2 Label" },
      { type: "text", x: 590, y: 128, width: 200, height: 36, text: "2,350", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 2 Value" },
      { type: "text", x: 590, y: 168, width: 140, height: 18, text: "+15.3% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 2 Change" },
      { type: "rectangle", x: 852, y: 80, width: 270, height: 120, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Stat Card 3" },
      { type: "text", x: 876, y: 100, width: 200, height: 20, text: "Conversion Rate", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 3 Label" },
      { type: "text", x: 876, y: 128, width: 200, height: 36, text: "3.2%", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 3 Value" },
      { type: "text", x: 876, y: 168, width: 140, height: 18, text: "-2.4% from last month", fontSize: 12, fontWeight: "500", fill: "#f87171", name: "Stat 3 Change" },
      { type: "rectangle", x: 1138, y: 80, width: 270, height: 120, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Stat Card 4" },
      { type: "text", x: 1162, y: 100, width: 200, height: 20, text: "Total Orders", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 4 Label" },
      { type: "text", x: 1162, y: 128, width: 200, height: 36, text: "1,234", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 4 Value" },
      { type: "text", x: 1162, y: 168, width: 140, height: 18, text: "+8.7% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 4 Change" },
      // Chart area
      { type: "rectangle", x: 280, y: 220, width: 840, height: 380, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Chart Card" },
      { type: "text", x: 304, y: 240, width: 200, height: 24, text: "Revenue Overview", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Chart Title" },
      // Chart bars (simplified bar chart)
      { type: "rectangle", x: 340, y: 460, width: 52, height: 100, fill: "#818cf8", cornerRadius: 4, name: "Bar Jan" },
      { type: "rectangle", x: 408, y: 420, width: 52, height: 140, fill: "#818cf8", cornerRadius: 4, name: "Bar Feb" },
      { type: "rectangle", x: 476, y: 380, width: 52, height: 180, fill: "#818cf8", cornerRadius: 4, name: "Bar Mar" },
      { type: "rectangle", x: 544, y: 440, width: 52, height: 120, fill: "#818cf8", cornerRadius: 4, name: "Bar Apr" },
      { type: "rectangle", x: 612, y: 360, width: 52, height: 200, fill: "#818cf8", cornerRadius: 4, name: "Bar May" },
      { type: "rectangle", x: 680, y: 320, width: 52, height: 240, fill: "#a78bfa", cornerRadius: 4, name: "Bar Jun" },
      { type: "rectangle", x: 748, y: 340, width: 52, height: 220, fill: "#818cf8", cornerRadius: 4, name: "Bar Jul" },
      { type: "rectangle", x: 816, y: 400, width: 52, height: 160, fill: "#818cf8", cornerRadius: 4, name: "Bar Aug" },
      { type: "rectangle", x: 884, y: 350, width: 52, height: 210, fill: "#818cf8", cornerRadius: 4, name: "Bar Sep" },
      { type: "rectangle", x: 952, y: 300, width: 52, height: 260, fill: "#818cf8", cornerRadius: 4, name: "Bar Oct" },
      { type: "rectangle", x: 1020, y: 310, width: 52, height: 250, fill: "#818cf8", cornerRadius: 4, name: "Bar Nov" },
      // Recent activity panel
      { type: "rectangle", x: 1138, y: 220, width: 270, height: 380, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Activity Panel" },
      { type: "text", x: 1162, y: 240, width: 200, height: 24, text: "Recent Activity", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Activity Title" },
      // Activity items
      { type: "ellipse", x: 1162, y: 285, width: 32, height: 32, fill: "#312e81", name: "Activity Dot 1" },
      { type: "text", x: 1202, y: 285, width: 180, height: 18, text: "New order #1234", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 1" },
      { type: "text", x: 1202, y: 305, width: 140, height: 16, text: "2 minutes ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 1 Time" },
      { type: "ellipse", x: 1162, y: 340, width: 32, height: 32, fill: "#1e3a5f", name: "Activity Dot 2" },
      { type: "text", x: 1202, y: 340, width: 180, height: 18, text: "User signup", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 2" },
      { type: "text", x: 1202, y: 360, width: 140, height: 16, text: "15 minutes ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 2 Time" },
      { type: "ellipse", x: 1162, y: 395, width: 32, height: 32, fill: "#1e3a3a", name: "Activity Dot 3" },
      { type: "text", x: 1202, y: 395, width: 180, height: 18, text: "Payment received", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 3" },
      { type: "text", x: 1202, y: 415, width: 140, height: 16, text: "1 hour ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 3 Time" },
      // Table
      { type: "rectangle", x: 280, y: 620, width: 1128, height: 260, fill: "#1a1a36", cornerRadius: 12, stroke: "#2a2a4a", strokeWidth: 1, name: "Table Card" },
      { type: "text", x: 304, y: 640, width: 200, height: 24, text: "Recent Orders", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Table Title" },
      // Table header
      { type: "rectangle", x: 304, y: 676, width: 1080, height: 36, fill: "#0f0f23", cornerRadius: 6, name: "Table Header" },
      { type: "text", x: 320, y: 682, width: 120, height: 20, text: "Order ID", fontSize: 13, fontWeight: "600", fill: "#71717a", name: "TH 1" },
      { type: "text", x: 520, y: 682, width: 120, height: 20, text: "Customer", fontSize: 13, fontWeight: "600", fill: "#71717a", name: "TH 2" },
      { type: "text", x: 760, y: 682, width: 120, height: 20, text: "Status", fontSize: 13, fontWeight: "600", fill: "#71717a", name: "TH 3" },
      { type: "text", x: 1000, y: 682, width: 120, height: 20, text: "Amount", fontSize: 13, fontWeight: "600", fill: "#71717a", name: "TH 4" },
      // Table rows
      { type: "text", x: 320, y: 724, width: 120, height: 20, text: "#1234", fontSize: 14, fontWeight: "500", fill: "#e4e4e7", name: "Row 1 ID" },
      { type: "text", x: 520, y: 724, width: 160, height: 20, text: "Sarah Johnson", fontSize: 14, fontWeight: "400", fill: "#e4e4e7", name: "Row 1 Name" },
      { type: "rectangle", x: 760, y: 720, width: 80, height: 28, fill: "#052e16", cornerRadius: 6, name: "Status 1" },
      { type: "text", x: 772, y: 724, width: 60, height: 20, text: "Paid", fontSize: 13, fontWeight: "500", fill: "#4ade80", name: "Status 1 Text" },
      { type: "text", x: 1000, y: 724, width: 120, height: 20, text: "$250.00", fontSize: 14, fontWeight: "600", fill: "#e4e4e7", name: "Row 1 Amount" },
      { type: "text", x: 320, y: 764, width: 120, height: 20, text: "#1233", fontSize: 14, fontWeight: "500", fill: "#e4e4e7", name: "Row 2 ID" },
      { type: "text", x: 520, y: 764, width: 160, height: 20, text: "Mike Peters", fontSize: 14, fontWeight: "400", fill: "#e4e4e7", name: "Row 2 Name" },
      { type: "rectangle", x: 760, y: 760, width: 80, height: 28, fill: "#422006", cornerRadius: 6, name: "Status 2" },
      { type: "text", x: 766, y: 764, width: 60, height: 20, text: "Pending", fontSize: 13, fontWeight: "500", fill: "#fbbf24", name: "Status 2 Text" },
      { type: "text", x: 1000, y: 764, width: 120, height: 20, text: "$120.00", fontSize: 14, fontWeight: "600", fill: "#e4e4e7", name: "Row 2 Amount" },
      { type: "text", x: 320, y: 804, width: 120, height: 20, text: "#1232", fontSize: 14, fontWeight: "500", fill: "#e4e4e7", name: "Row 3 ID" },
      { type: "text", x: 520, y: 804, width: 160, height: 20, text: "Emma Wilson", fontSize: 14, fontWeight: "400", fill: "#e4e4e7", name: "Row 3 Name" },
      { type: "rectangle", x: 760, y: 800, width: 80, height: 28, fill: "#052e16", cornerRadius: 6, name: "Status 3" },
      { type: "text", x: 772, y: 804, width: 60, height: 20, text: "Paid", fontSize: 13, fontWeight: "500", fill: "#4ade80", name: "Status 3 Text" },
      { type: "text", x: 1000, y: 804, width: 120, height: 20, text: "$89.99", fontSize: 14, fontWeight: "600", fill: "#e4e4e7", name: "Row 3 Amount" },
    ],
  },
};

export default class AiServiceService extends Service {
  @service declare designStore: DesignStoreService;

  @tracked lastPrompt: string = "";

  get availableTemplates(): string[] {
    return Object.keys(TEMPLATES);
  }

  async generateFromPrompt(prompt: string): Promise<void> {
    this.lastPrompt = prompt;
    this.designStore.aiGenerating = true;

    // Find best matching template
    const lowerPrompt = prompt.toLowerCase();
    let bestMatch = "landing page";

    if (lowerPrompt.includes("mobile") || lowerPrompt.includes("app") || lowerPrompt.includes("phone") || lowerPrompt.includes("ios") || lowerPrompt.includes("android")) {
      bestMatch = "mobile app";
    } else if (lowerPrompt.includes("dashboard") || lowerPrompt.includes("admin") || lowerPrompt.includes("analytics") || lowerPrompt.includes("data") || lowerPrompt.includes("chart")) {
      bestMatch = "dashboard";
    }

    // Simulate AI processing time with progress
    await new Promise((resolve) => setTimeout(resolve, 800));
    await new Promise((resolve) => setTimeout(resolve, 600));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const template = TEMPLATES[bestMatch]!;
    this.designStore.pushHistory();
    this.designStore.clearCanvas();

    // Add elements one batch at a time for visual effect
    const batchSize = 5;
    for (let i = 0; i < template.elements.length; i += batchSize) {
      const batch = template.elements.slice(i, i + batchSize);
      for (const elData of batch) {
        this.designStore.createElement(
          elData.type as any,
          elData,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    this.designStore.aiGenerating = false;
    this.designStore.showAiModal = false;

    // Zoom to fit the generated content
    setTimeout(() => {
      this.designStore.zoomToFit();
    }, 100);
  }
}
