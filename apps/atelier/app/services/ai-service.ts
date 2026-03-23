import Service from "@ember/service";
import { inject as service } from "@ember/service";
import { tracked } from "@glimmer/tracking";
import type DesignStoreService from "./design-store";
import type { DesignElement } from "./design-store";

interface AiTemplate {
  name: string;
  elements: Partial<DesignElement>[];
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface AgentStep {
  message: string;
  status: "pending" | "complete";
}

const TEMPLATES: Record<string, AiTemplate> = {
  "landing page": {
    name: "Landing Page",
    elements: [
      // Hero section background
      { type: "frame", x: 0, y: 0, width: 1440, height: 800, fill: "#0f0f12", stroke: "transparent", name: "Hero Section", cornerRadius: 0 },
      // Nav bar
      { type: "rectangle", x: 0, y: 0, width: 1440, height: 72, fill: "#1a1a1f", stroke: "transparent", name: "Nav Bar", opacity: 0.95 },
      { type: "text", x: 40, y: 18, width: 200, height: 36, text: "Atelier", fontSize: 28, fontWeight: "700", fill: "#10b981", name: "Logo" },
      { type: "text", x: 800, y: 24, width: 80, height: 24, text: "Features", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 1" },
      { type: "text", x: 920, y: 24, width: 80, height: 24, text: "Pricing", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 2" },
      { type: "text", x: 1040, y: 24, width: 80, height: 24, text: "Docs", fontSize: 16, fontWeight: "400", fill: "#e4e4e7", name: "Nav Link 3" },
      { type: "rectangle", x: 1280, y: 16, width: 120, height: 40, fill: "#10b981", cornerRadius: 8, name: "CTA Nav Button" },
      { type: "text", x: 1303, y: 22, width: 80, height: 24, text: "Sign Up", fontSize: 15, fontWeight: "600", fill: "#ffffff", name: "CTA Nav Text" },
      // Hero content
      { type: "rectangle", x: 620, y: 120, width: 200, height: 32, fill: "#2a2a32", cornerRadius: 16, name: "Badge" },
      { type: "text", x: 640, y: 124, width: 180, height: 24, text: "Now in Public Beta", fontSize: 14, fontWeight: "500", fill: "#34d399", name: "Badge Text" },
      { type: "text", x: 260, y: 180, width: 920, height: 80, text: "Design at the speed", fontSize: 72, fontWeight: "800", fill: "#ffffff", name: "Hero Title L1" },
      { type: "text", x: 390, y: 270, width: 660, height: 80, text: "of thought", fontSize: 72, fontWeight: "800", fill: "#10b981", name: "Hero Title L2" },
      { type: "text", x: 360, y: 370, width: 720, height: 56, text: "The AI-native design tool that turns your ideas into", fontSize: 20, fontWeight: "400", fill: "#a1a1aa", name: "Subtitle L1" },
      { type: "text", x: 400, y: 400, width: 640, height: 56, text: "polished interfaces in seconds, not hours.", fontSize: 20, fontWeight: "400", fill: "#a1a1aa", name: "Subtitle L2" },
      // CTA buttons
      { type: "rectangle", x: 520, y: 470, width: 200, height: 52, fill: "#10b981", cornerRadius: 12, name: "Primary CTA" },
      { type: "text", x: 555, y: 480, width: 140, height: 32, text: "Get Started", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Primary CTA Text" },
      { type: "rectangle", x: 740, y: 470, width: 200, height: 52, fill: "transparent", stroke: "#52525b", strokeWidth: 2, cornerRadius: 12, name: "Secondary CTA" },
      { type: "text", x: 770, y: 480, width: 160, height: 32, text: "Watch Demo", fontSize: 18, fontWeight: "600", fill: "#e4e4e7", name: "Secondary CTA Text" },
      // Floating preview card
      { type: "rectangle", x: 320, y: 560, width: 800, height: 220, fill: "#1e1e24", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Preview Card" },
      { type: "rectangle", x: 340, y: 580, width: 360, height: 180, fill: "#252530", cornerRadius: 8, name: "Preview Left" },
      { type: "rectangle", x: 720, y: 580, width: 380, height: 80, fill: "#252530", cornerRadius: 8, name: "Preview Right Top" },
      { type: "rectangle", x: 720, y: 680, width: 380, height: 80, fill: "#252530", cornerRadius: 8, name: "Preview Right Bottom" },
      // Stats row
      { type: "rectangle", x: 0, y: 800, width: 1440, height: 120, fill: "#141418", name: "Stats Bar" },
      { type: "text", x: 180, y: 830, width: 120, height: 40, text: "10k+", fontSize: 36, fontWeight: "700", fill: "#10b981", name: "Stat 1 Number" },
      { type: "text", x: 180, y: 870, width: 120, height: 24, text: "Designers", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 1 Label" },
      { type: "text", x: 540, y: 830, width: 120, height: 40, text: "50M+", fontSize: 36, fontWeight: "700", fill: "#10b981", name: "Stat 2 Number" },
      { type: "text", x: 530, y: 870, width: 140, height: 24, text: "Designs Created", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 2 Label" },
      { type: "text", x: 900, y: 830, width: 120, height: 40, text: "99.9%", fontSize: 36, fontWeight: "700", fill: "#10b981", name: "Stat 3 Number" },
      { type: "text", x: 910, y: 870, width: 120, height: 24, text: "Uptime", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 3 Label" },
      { type: "text", x: 1200, y: 830, width: 120, height: 40, text: "4.9", fontSize: 36, fontWeight: "700", fill: "#10b981", name: "Stat 4 Number" },
      { type: "text", x: 1200, y: 870, width: 120, height: 24, text: "Rating", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 4 Label" },
      // Features section
      { type: "frame", x: 0, y: 920, width: 1440, height: 600, fill: "#0f0f12", stroke: "transparent", name: "Features Section", cornerRadius: 0 },
      { type: "text", x: 480, y: 960, width: 480, height: 48, text: "Powerful Features", fontSize: 42, fontWeight: "700", fill: "#ffffff", name: "Features Title" },
      { type: "text", x: 400, y: 1020, width: 640, height: 32, text: "Everything you need to bring your designs to life", fontSize: 18, fontWeight: "400", fill: "#71717a", name: "Features Subtitle" },
      // Feature cards
      { type: "rectangle", x: 80, y: 1080, width: 400, height: 280, fill: "#1a1a1f", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Feature Card 1" },
      { type: "ellipse", x: 110, y: 1110, width: 48, height: 48, fill: "#064e3b", name: "Feature Icon 1" },
      { type: "text", x: 110, y: 1180, width: 340, height: 32, text: "AI-Powered Design", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 1 Title" },
      { type: "text", x: 110, y: 1220, width: 340, height: 60, text: "Describe your vision and watch it come to life with intelligent layout generation.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 1 Desc" },
      { type: "rectangle", x: 520, y: 1080, width: 400, height: 280, fill: "#1a1a1f", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Feature Card 2" },
      { type: "ellipse", x: 550, y: 1110, width: 48, height: 48, fill: "#1e3a5f", name: "Feature Icon 2" },
      { type: "text", x: 550, y: 1180, width: 340, height: 32, text: "Real-time Collaboration", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 2 Title" },
      { type: "text", x: 550, y: 1220, width: 340, height: 60, text: "Work together with your team in real-time with multiplayer cursors and comments.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 2 Desc" },
      { type: "rectangle", x: 960, y: 1080, width: 400, height: 280, fill: "#1a1a1f", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Feature Card 3" },
      { type: "ellipse", x: 990, y: 1110, width: 48, height: 48, fill: "#1e3a3a", name: "Feature Icon 3" },
      { type: "text", x: 990, y: 1180, width: 340, height: 32, text: "Design Systems", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Feature 3 Title" },
      { type: "text", x: 990, y: 1220, width: 340, height: 60, text: "Build and maintain consistent design systems with tokens, components, and variants.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Feature 3 Desc" },
    ],
  },
  "mobile app": {
    name: "Mobile App",
    elements: [
      // Phone frame
      { type: "rectangle", x: 520, y: 40, width: 390, height: 844, fill: "#0f0f12", cornerRadius: 44, stroke: "#2a2a32", strokeWidth: 2, name: "Phone Frame" },
      // Status bar
      { type: "text", x: 556, y: 60, width: 60, height: 20, text: "9:41", fontSize: 15, fontWeight: "600", fill: "#ffffff", name: "Time" },
      { type: "rectangle", x: 640, y: 56, width: 150, height: 28, fill: "#1a1a1f", cornerRadius: 14, name: "Dynamic Island" },
      // Header
      { type: "text", x: 556, y: 110, width: 260, height: 36, text: "Good morning", fontSize: 16, fontWeight: "400", fill: "#71717a", name: "Greeting" },
      { type: "text", x: 556, y: 140, width: 280, height: 40, text: "Alex Chen", fontSize: 28, fontWeight: "700", fill: "#ffffff", name: "User Name" },
      { type: "ellipse", x: 852, y: 110, width: 44, height: 44, fill: "#10b981", name: "Avatar" },
      // Search bar
      { type: "rectangle", x: 546, y: 190, width: 338, height: 48, fill: "#1a1a1f", cornerRadius: 12, name: "Search Bar" },
      { type: "text", x: 580, y: 200, width: 200, height: 28, text: "Search...", fontSize: 16, fontWeight: "400", fill: "#52525b", name: "Search Placeholder" },
      // Quick actions
      { type: "rectangle", x: 546, y: 260, width: 76, height: 76, fill: "#064e3b", cornerRadius: 20, name: "Action 1" },
      { type: "text", x: 556, y: 345, width: 56, height: 16, text: "Wallet", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 1 Label" },
      { type: "rectangle", x: 634, y: 260, width: 76, height: 76, fill: "#1e3a5f", cornerRadius: 20, name: "Action 2" },
      { type: "text", x: 641, y: 345, width: 62, height: 16, text: "Transfer", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 2 Label" },
      { type: "rectangle", x: 722, y: 260, width: 76, height: 76, fill: "#1e3a3a", cornerRadius: 20, name: "Action 3" },
      { type: "text", x: 734, y: 345, width: 52, height: 16, text: "Cards", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 3 Label" },
      { type: "rectangle", x: 810, y: 260, width: 76, height: 76, fill: "#3a1e3a", cornerRadius: 20, name: "Action 4" },
      { type: "text", x: 823, y: 345, width: 50, height: 16, text: "More", fontSize: 12, fontWeight: "500", fill: "#a1a1aa", name: "Action 4 Label" },
      // Balance card
      { type: "rectangle", x: 546, y: 380, width: 338, height: 160, fill: "#10b981", cornerRadius: 20, name: "Balance Card" },
      { type: "text", x: 572, y: 400, width: 200, height: 24, text: "Total Balance", fontSize: 14, fontWeight: "500", fill: "rgba(255,255,255,0.7)", name: "Balance Label" },
      { type: "text", x: 572, y: 430, width: 240, height: 48, text: "$12,580.00", fontSize: 36, fontWeight: "700", fill: "#ffffff", name: "Balance Amount" },
      { type: "text", x: 572, y: 490, width: 140, height: 20, text: "+2.5% this month", fontSize: 14, fontWeight: "500", fill: "rgba(255,255,255,0.8)", name: "Balance Change" },
      // Transactions header
      { type: "text", x: 556, y: 570, width: 200, height: 28, text: "Recent Activity", fontSize: 20, fontWeight: "600", fill: "#ffffff", name: "Activity Header" },
      { type: "text", x: 822, y: 574, width: 60, height: 20, text: "See all", fontSize: 14, fontWeight: "500", fill: "#10b981", name: "See All" },
      // Transaction items
      { type: "rectangle", x: 546, y: 610, width: 338, height: 64, fill: "#1a1a1f", cornerRadius: 12, name: "Transaction 1" },
      { type: "ellipse", x: 562, y: 622, width: 40, height: 40, fill: "#064e3b", name: "Tx Icon 1" },
      { type: "text", x: 614, y: 620, width: 160, height: 20, text: "Apple Store", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 1 Name" },
      { type: "text", x: 614, y: 644, width: 120, height: 18, text: "Mar 15, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 1 Date" },
      { type: "text", x: 820, y: 630, width: 60, height: 20, text: "-$29.99", fontSize: 15, fontWeight: "600", fill: "#f87171", name: "Tx 1 Amount" },
      { type: "rectangle", x: 546, y: 686, width: 338, height: 64, fill: "#1a1a1f", cornerRadius: 12, name: "Transaction 2" },
      { type: "ellipse", x: 562, y: 698, width: 40, height: 40, fill: "#1e3a3a", name: "Tx Icon 2" },
      { type: "text", x: 614, y: 696, width: 160, height: 20, text: "Salary Deposit", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 2 Name" },
      { type: "text", x: 614, y: 720, width: 120, height: 18, text: "Mar 14, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 2 Date" },
      { type: "text", x: 804, y: 706, width: 80, height: 20, text: "+$4,200", fontSize: 15, fontWeight: "600", fill: "#4ade80", name: "Tx 2 Amount" },
      { type: "rectangle", x: 546, y: 762, width: 338, height: 64, fill: "#1a1a1f", cornerRadius: 12, name: "Transaction 3" },
      { type: "ellipse", x: 562, y: 774, width: 40, height: 40, fill: "#3a1e3a", name: "Tx Icon 3" },
      { type: "text", x: 614, y: 772, width: 160, height: 20, text: "Netflix", fontSize: 15, fontWeight: "500", fill: "#ffffff", name: "Tx 3 Name" },
      { type: "text", x: 614, y: 796, width: 120, height: 18, text: "Mar 13, 2024", fontSize: 13, fontWeight: "400", fill: "#71717a", name: "Tx 3 Date" },
      { type: "text", x: 820, y: 782, width: 60, height: 20, text: "-$15.99", fontSize: 15, fontWeight: "600", fill: "#f87171", name: "Tx 3 Amount" },
      // Bottom nav
      { type: "rectangle", x: 520, y: 840, width: 390, height: 44, fill: "#0f0f12", cornerRadius: 0, name: "Bottom Nav BG" },
      { type: "ellipse", x: 570, y: 846, width: 28, height: 28, fill: "#10b981", name: "Nav Home" },
      { type: "ellipse", x: 660, y: 846, width: 28, height: 28, fill: "#2a2a32", name: "Nav Stats" },
      { type: "ellipse", x: 750, y: 846, width: 28, height: 28, fill: "#2a2a32", name: "Nav Cards" },
      { type: "ellipse", x: 840, y: 846, width: 28, height: 28, fill: "#2a2a32", name: "Nav Profile" },
    ],
  },
  "dashboard": {
    name: "Dashboard",
    elements: [
      // Sidebar
      { type: "rectangle", x: 0, y: 0, width: 240, height: 900, fill: "#111116", stroke: "transparent", name: "Sidebar" },
      { type: "text", x: 24, y: 24, width: 160, height: 32, text: "Analytics", fontSize: 22, fontWeight: "700", fill: "#10b981", name: "App Name" },
      // Sidebar nav items
      { type: "rectangle", x: 12, y: 80, width: 216, height: 40, fill: "#1e1e24", cornerRadius: 8, name: "Nav Active" },
      { type: "text", x: 48, y: 88, width: 140, height: 24, text: "Dashboard", fontSize: 14, fontWeight: "600", fill: "#ffffff", name: "Nav 1" },
      { type: "text", x: 48, y: 136, width: 140, height: 24, text: "Analytics", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 2" },
      { type: "text", x: 48, y: 172, width: 140, height: 24, text: "Customers", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 3" },
      { type: "text", x: 48, y: 208, width: 140, height: 24, text: "Products", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 4" },
      { type: "text", x: 48, y: 244, width: 140, height: 24, text: "Orders", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 5" },
      { type: "text", x: 48, y: 280, width: 140, height: 24, text: "Settings", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Nav 6" },
      // Main content area
      { type: "frame", x: 240, y: 0, width: 1200, height: 900, fill: "#0f0f12", stroke: "transparent", name: "Main Content", cornerRadius: 0 },
      // Top bar
      { type: "text", x: 280, y: 28, width: 200, height: 32, text: "Dashboard", fontSize: 24, fontWeight: "600", fill: "#ffffff", name: "Page Title" },
      { type: "rectangle", x: 1240, y: 20, width: 160, height: 40, fill: "#10b981", cornerRadius: 8, name: "Action Button" },
      { type: "text", x: 1260, y: 28, width: 120, height: 24, text: "Export Report", fontSize: 14, fontWeight: "600", fill: "#ffffff", name: "Action Text" },
      // Stat cards row
      { type: "rectangle", x: 280, y: 80, width: 270, height: 120, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Stat Card 1" },
      { type: "text", x: 304, y: 100, width: 200, height: 20, text: "Total Revenue", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 1 Label" },
      { type: "text", x: 304, y: 128, width: 200, height: 36, text: "$45,231", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 1 Value" },
      { type: "text", x: 304, y: 168, width: 140, height: 18, text: "+20.1% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 1 Change" },
      { type: "rectangle", x: 566, y: 80, width: 270, height: 120, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Stat Card 2" },
      { type: "text", x: 590, y: 100, width: 200, height: 20, text: "Active Users", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 2 Label" },
      { type: "text", x: 590, y: 128, width: 200, height: 36, text: "2,350", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 2 Value" },
      { type: "text", x: 590, y: 168, width: 140, height: 18, text: "+15.3% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 2 Change" },
      { type: "rectangle", x: 852, y: 80, width: 270, height: 120, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Stat Card 3" },
      { type: "text", x: 876, y: 100, width: 200, height: 20, text: "Conversion Rate", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 3 Label" },
      { type: "text", x: 876, y: 128, width: 200, height: 36, text: "3.2%", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 3 Value" },
      { type: "text", x: 876, y: 168, width: 140, height: 18, text: "-2.4% from last month", fontSize: 12, fontWeight: "500", fill: "#f87171", name: "Stat 3 Change" },
      { type: "rectangle", x: 1138, y: 80, width: 270, height: 120, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Stat Card 4" },
      { type: "text", x: 1162, y: 100, width: 200, height: 20, text: "Total Orders", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Stat 4 Label" },
      { type: "text", x: 1162, y: 128, width: 200, height: 36, text: "1,234", fontSize: 30, fontWeight: "700", fill: "#ffffff", name: "Stat 4 Value" },
      { type: "text", x: 1162, y: 168, width: 140, height: 18, text: "+8.7% from last month", fontSize: 12, fontWeight: "500", fill: "#4ade80", name: "Stat 4 Change" },
      // Chart area
      { type: "rectangle", x: 280, y: 220, width: 840, height: 380, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Chart Card" },
      { type: "text", x: 304, y: 240, width: 200, height: 24, text: "Revenue Overview", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Chart Title" },
      // Chart bars
      { type: "rectangle", x: 340, y: 460, width: 52, height: 100, fill: "#10b981", cornerRadius: 4, name: "Bar Jan" },
      { type: "rectangle", x: 408, y: 420, width: 52, height: 140, fill: "#10b981", cornerRadius: 4, name: "Bar Feb" },
      { type: "rectangle", x: 476, y: 380, width: 52, height: 180, fill: "#10b981", cornerRadius: 4, name: "Bar Mar" },
      { type: "rectangle", x: 544, y: 440, width: 52, height: 120, fill: "#10b981", cornerRadius: 4, name: "Bar Apr" },
      { type: "rectangle", x: 612, y: 360, width: 52, height: 200, fill: "#10b981", cornerRadius: 4, name: "Bar May" },
      { type: "rectangle", x: 680, y: 320, width: 52, height: 240, fill: "#34d399", cornerRadius: 4, name: "Bar Jun" },
      { type: "rectangle", x: 748, y: 340, width: 52, height: 220, fill: "#10b981", cornerRadius: 4, name: "Bar Jul" },
      { type: "rectangle", x: 816, y: 400, width: 52, height: 160, fill: "#10b981", cornerRadius: 4, name: "Bar Aug" },
      { type: "rectangle", x: 884, y: 350, width: 52, height: 210, fill: "#10b981", cornerRadius: 4, name: "Bar Sep" },
      { type: "rectangle", x: 952, y: 300, width: 52, height: 260, fill: "#10b981", cornerRadius: 4, name: "Bar Oct" },
      { type: "rectangle", x: 1020, y: 310, width: 52, height: 250, fill: "#10b981", cornerRadius: 4, name: "Bar Nov" },
      // Recent activity panel
      { type: "rectangle", x: 1138, y: 220, width: 270, height: 380, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Activity Panel" },
      { type: "text", x: 1162, y: 240, width: 200, height: 24, text: "Recent Activity", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Activity Title" },
      // Activity items
      { type: "ellipse", x: 1162, y: 285, width: 32, height: 32, fill: "#064e3b", name: "Activity Dot 1" },
      { type: "text", x: 1202, y: 285, width: 180, height: 18, text: "New order #1234", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 1" },
      { type: "text", x: 1202, y: 305, width: 140, height: 16, text: "2 minutes ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 1 Time" },
      { type: "ellipse", x: 1162, y: 340, width: 32, height: 32, fill: "#1e3a5f", name: "Activity Dot 2" },
      { type: "text", x: 1202, y: 340, width: 180, height: 18, text: "User signup", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 2" },
      { type: "text", x: 1202, y: 360, width: 140, height: 16, text: "15 minutes ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 2 Time" },
      { type: "ellipse", x: 1162, y: 395, width: 32, height: 32, fill: "#1e3a3a", name: "Activity Dot 3" },
      { type: "text", x: 1202, y: 395, width: 180, height: 18, text: "Payment received", fontSize: 13, fontWeight: "500", fill: "#e4e4e7", name: "Activity 3" },
      { type: "text", x: 1202, y: 415, width: 140, height: 16, text: "1 hour ago", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Activity 3 Time" },
      // Table
      { type: "rectangle", x: 280, y: 620, width: 1128, height: 260, fill: "#1a1a1f", cornerRadius: 12, stroke: "#2a2a32", strokeWidth: 1, name: "Table Card" },
      { type: "text", x: 304, y: 640, width: 200, height: 24, text: "Recent Orders", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Table Title" },
      // Table header
      { type: "rectangle", x: 304, y: 676, width: 1080, height: 36, fill: "#0f0f12", cornerRadius: 6, name: "Table Header" },
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
  "pricing page": {
    name: "Pricing Page",
    elements: [
      { type: "frame", x: 0, y: 0, width: 1440, height: 900, fill: "#0f0f12", stroke: "transparent", name: "Pricing Section", cornerRadius: 0 },
      { type: "text", x: 460, y: 60, width: 520, height: 48, text: "Simple pricing", fontSize: 48, fontWeight: "800", fill: "#ffffff", name: "Pricing Title" },
      { type: "text", x: 400, y: 120, width: 640, height: 28, text: "Choose the plan that works best for your team", fontSize: 18, fontWeight: "400", fill: "#71717a", name: "Pricing Subtitle" },
      // Free plan
      { type: "rectangle", x: 140, y: 200, width: 360, height: 520, fill: "#1a1a1f", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Free Card" },
      { type: "text", x: 172, y: 232, width: 200, height: 28, text: "Free", fontSize: 22, fontWeight: "600", fill: "#e4e4e7", name: "Free Label" },
      { type: "text", x: 172, y: 272, width: 200, height: 48, text: "$0", fontSize: 42, fontWeight: "800", fill: "#ffffff", name: "Free Price" },
      { type: "text", x: 172, y: 320, width: 200, height: 20, text: "per month", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Free Period" },
      { type: "text", x: 172, y: 368, width: 280, height: 20, text: "3 projects", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Free F1" },
      { type: "text", x: 172, y: 400, width: 280, height: 20, text: "Basic export (SVG)", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Free F2" },
      { type: "text", x: 172, y: 432, width: 280, height: 20, text: "Community templates", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Free F3" },
      { type: "rectangle", x: 172, y: 620, width: 296, height: 48, fill: "transparent", cornerRadius: 10, stroke: "#52525b", strokeWidth: 2, name: "Free CTA", elementRole: "button" },
      { type: "text", x: 262, y: 630, width: 120, height: 24, text: "Get Started", fontSize: 16, fontWeight: "600", fill: "#e4e4e7", name: "Free CTA Text" },
      // Pro plan
      { type: "rectangle", x: 540, y: 180, width: 360, height: 560, fill: "#1e1e24", cornerRadius: 16, stroke: "#10b981", strokeWidth: 2, name: "Pro Card" },
      { type: "rectangle", x: 780, y: 206, width: 88, height: 24, fill: "#064e3b", cornerRadius: 12, name: "Pro Badge" },
      { type: "text", x: 790, y: 208, width: 68, height: 18, text: "Popular", fontSize: 12, fontWeight: "600", fill: "#10b981", name: "Pro Badge Text" },
      { type: "text", x: 572, y: 232, width: 200, height: 28, text: "Pro", fontSize: 22, fontWeight: "600", fill: "#10b981", name: "Pro Label" },
      { type: "text", x: 572, y: 272, width: 200, height: 48, text: "$12", fontSize: 42, fontWeight: "800", fill: "#ffffff", name: "Pro Price" },
      { type: "text", x: 572, y: 320, width: 200, height: 20, text: "per month", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Pro Period" },
      { type: "text", x: 572, y: 368, width: 280, height: 20, text: "Unlimited projects", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Pro F1" },
      { type: "text", x: 572, y: 400, width: 280, height: 20, text: "All export formats", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Pro F2" },
      { type: "text", x: 572, y: 432, width: 280, height: 20, text: "AI design generation", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Pro F3" },
      { type: "text", x: 572, y: 464, width: 280, height: 20, text: "Custom Tailwind tokens", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Pro F4" },
      { type: "text", x: 572, y: 496, width: 280, height: 20, text: "Priority support", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Pro F5" },
      { type: "rectangle", x: 572, y: 640, width: 296, height: 48, fill: "#10b981", cornerRadius: 10, name: "Pro CTA", elementRole: "button" },
      { type: "text", x: 656, y: 650, width: 140, height: 24, text: "Start Free Trial", fontSize: 16, fontWeight: "600", fill: "#ffffff", name: "Pro CTA Text" },
      // Team plan
      { type: "rectangle", x: 940, y: 200, width: 360, height: 520, fill: "#1a1a1f", cornerRadius: 16, stroke: "#2a2a32", strokeWidth: 1, name: "Team Card" },
      { type: "text", x: 972, y: 232, width: 200, height: 28, text: "Team", fontSize: 22, fontWeight: "600", fill: "#e4e4e7", name: "Team Label" },
      { type: "text", x: 972, y: 272, width: 200, height: 48, text: "$29", fontSize: 42, fontWeight: "800", fill: "#ffffff", name: "Team Price" },
      { type: "text", x: 972, y: 320, width: 200, height: 20, text: "per user / month", fontSize: 14, fontWeight: "400", fill: "#71717a", name: "Team Period" },
      { type: "text", x: 972, y: 368, width: 280, height: 20, text: "Everything in Pro", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Team F1" },
      { type: "text", x: 972, y: 400, width: 280, height: 20, text: "Team collaboration", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Team F2" },
      { type: "text", x: 972, y: 432, width: 280, height: 20, text: "Design system sync", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Team F3" },
      { type: "text", x: 972, y: 464, width: 280, height: 20, text: "Version history", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Team F4" },
      { type: "text", x: 972, y: 496, width: 280, height: 20, text: "SSO & admin controls", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Team F5" },
      { type: "rectangle", x: 972, y: 620, width: 296, height: 48, fill: "transparent", cornerRadius: 10, stroke: "#52525b", strokeWidth: 2, name: "Team CTA", elementRole: "button" },
      { type: "text", x: 1058, y: 630, width: 140, height: 24, text: "Contact Sales", fontSize: 16, fontWeight: "600", fill: "#e4e4e7", name: "Team CTA Text" },
    ],
  },
  "signup": {
    name: "Signup Form",
    elements: [
      { type: "frame", x: 0, y: 0, width: 1440, height: 900, fill: "#0f0f12", stroke: "transparent", name: "Auth Page", cornerRadius: 0 },
      // Left side — branding
      { type: "rectangle", x: 0, y: 0, width: 720, height: 900, fill: "#111116", name: "Left Panel" },
      { type: "text", x: 80, y: 80, width: 200, height: 36, text: "Atelier", fontSize: 32, fontWeight: "700", fill: "#10b981", name: "Logo" },
      { type: "text", x: 80, y: 360, width: 560, height: 60, text: "Design at the speed", fontSize: 48, fontWeight: "800", fill: "#ffffff", name: "Tagline L1" },
      { type: "text", x: 80, y: 420, width: 560, height: 60, text: "of thought.", fontSize: 48, fontWeight: "800", fill: "#10b981", name: "Tagline L2" },
      { type: "text", x: 80, y: 500, width: 500, height: 28, text: "Join 10,000+ designers creating with AI", fontSize: 18, fontWeight: "400", fill: "#71717a", name: "Social Proof" },
      // Right side — form
      { type: "text", x: 840, y: 200, width: 400, height: 36, text: "Create your account", fontSize: 28, fontWeight: "700", fill: "#ffffff", name: "Form Title" },
      { type: "text", x: 840, y: 244, width: 400, height: 24, text: "Start your free 14-day trial", fontSize: 16, fontWeight: "400", fill: "#71717a", name: "Form Subtitle" },
      { type: "rectangle", x: 840, y: 300, width: 440, height: 48, fill: "#1a1a1f", cornerRadius: 10, stroke: "#2a2a32", strokeWidth: 1, name: "Google Button", elementRole: "button" },
      { type: "text", x: 960, y: 312, width: 200, height: 24, text: "Continue with Google", fontSize: 15, fontWeight: "500", fill: "#e4e4e7", name: "Google Text" },
      { type: "line", x: 840, y: 380, width: 440, height: 1, stroke: "#2a2a32", strokeWidth: 1, x1: 840, y1: 380, x2: 1280, y2: 380, name: "Divider" },
      { type: "text", x: 840, y: 410, width: 440, height: 18, text: "Full name", fontSize: 13, fontWeight: "500", fill: "#a1a1aa", name: "Name Label" },
      { type: "rectangle", x: 840, y: 432, width: 440, height: 44, fill: "#1a1a1f", cornerRadius: 8, stroke: "#2a2a32", strokeWidth: 1, name: "Name Input", elementRole: "input" },
      { type: "text", x: 840, y: 500, width: 440, height: 18, text: "Email", fontSize: 13, fontWeight: "500", fill: "#a1a1aa", name: "Email Label" },
      { type: "rectangle", x: 840, y: 522, width: 440, height: 44, fill: "#1a1a1f", cornerRadius: 8, stroke: "#2a2a32", strokeWidth: 1, name: "Email Input", elementRole: "input" },
      { type: "text", x: 840, y: 590, width: 440, height: 18, text: "Password", fontSize: 13, fontWeight: "500", fill: "#a1a1aa", name: "Password Label" },
      { type: "rectangle", x: 840, y: 612, width: 440, height: 44, fill: "#1a1a1f", cornerRadius: 8, stroke: "#2a2a32", strokeWidth: 1, name: "Password Input", elementRole: "input" },
      { type: "rectangle", x: 840, y: 688, width: 440, height: 48, fill: "#10b981", cornerRadius: 10, name: "Submit Button", elementRole: "button" },
      { type: "text", x: 992, y: 698, width: 140, height: 24, text: "Create Account", fontSize: 16, fontWeight: "600", fill: "#ffffff", name: "Submit Text" },
      { type: "text", x: 920, y: 756, width: 280, height: 20, text: "Already have an account? Sign in", fontSize: 14, fontWeight: "400", fill: "#10b981", name: "Signin Link", elementRole: "link" },
    ],
  },
  "ecommerce": {
    name: "Product Page",
    elements: [
      { type: "frame", x: 0, y: 0, width: 1440, height: 900, fill: "#0f0f12", stroke: "transparent", name: "Product Page", cornerRadius: 0 },
      // Nav
      { type: "rectangle", x: 0, y: 0, width: 1440, height: 64, fill: "#111116", name: "Nav" },
      { type: "text", x: 40, y: 18, width: 120, height: 28, text: "STORE", fontSize: 20, fontWeight: "700", fill: "#10b981", name: "Store Logo" },
      { type: "text", x: 600, y: 22, width: 60, height: 20, text: "Shop", fontSize: 14, fontWeight: "500", fill: "#e4e4e7", name: "Nav 1", elementRole: "link" },
      { type: "text", x: 700, y: 22, width: 80, height: 20, text: "Categories", fontSize: 14, fontWeight: "500", fill: "#e4e4e7", name: "Nav 2", elementRole: "link" },
      { type: "text", x: 820, y: 22, width: 60, height: 20, text: "Sale", fontSize: 14, fontWeight: "500", fill: "#f87171", name: "Nav 3", elementRole: "link" },
      { type: "ellipse", x: 1360, y: 16, width: 32, height: 32, fill: "#1e1e24", name: "Cart Icon" },
      // Product image area
      { type: "rectangle", x: 80, y: 100, width: 640, height: 640, fill: "#1a1a1f", cornerRadius: 16, name: "Product Image" },
      { type: "rectangle", x: 80, y: 760, width: 148, height: 100, fill: "#1a1a1f", cornerRadius: 8, stroke: "#10b981", strokeWidth: 2, name: "Thumb 1" },
      { type: "rectangle", x: 244, y: 760, width: 148, height: 100, fill: "#1a1a1f", cornerRadius: 8, name: "Thumb 2" },
      { type: "rectangle", x: 408, y: 760, width: 148, height: 100, fill: "#1a1a1f", cornerRadius: 8, name: "Thumb 3" },
      { type: "rectangle", x: 572, y: 760, width: 148, height: 100, fill: "#1a1a1f", cornerRadius: 8, name: "Thumb 4" },
      // Product details
      { type: "text", x: 800, y: 120, width: 560, height: 20, text: "New Collection", fontSize: 14, fontWeight: "500", fill: "#10b981", name: "Category" },
      { type: "text", x: 800, y: 152, width: 560, height: 44, text: "Premium Wireless Headphones", fontSize: 36, fontWeight: "700", fill: "#ffffff", name: "Product Name" },
      { type: "text", x: 800, y: 220, width: 560, height: 36, text: "$299.00", fontSize: 32, fontWeight: "700", fill: "#10b981", name: "Price" },
      { type: "text", x: 900, y: 228, width: 80, height: 20, text: "$399.00", fontSize: 16, fontWeight: "400", fill: "#52525b", name: "Original Price" },
      { type: "rectangle", x: 990, y: 224, width: 64, height: 28, fill: "#052e16", cornerRadius: 6, name: "Discount Badge" },
      { type: "text", x: 1000, y: 228, width: 44, height: 20, text: "-25%", fontSize: 13, fontWeight: "600", fill: "#4ade80", name: "Discount Text" },
      // Rating
      { type: "text", x: 800, y: 280, width: 200, height: 20, text: "4.8 (2,456 reviews)", fontSize: 14, fontWeight: "500", fill: "#fbbf24", name: "Rating" },
      // Description
      { type: "text", x: 800, y: 320, width: 540, height: 60, text: "Experience studio-quality sound with active noise cancellation, 30-hour battery life, and premium materials crafted for all-day comfort.", fontSize: 15, fontWeight: "400", fill: "#a1a1aa", name: "Description" },
      // Size selector
      { type: "text", x: 800, y: 410, width: 100, height: 20, text: "Color", fontSize: 14, fontWeight: "600", fill: "#e4e4e7", name: "Color Label" },
      { type: "ellipse", x: 800, y: 440, width: 36, height: 36, fill: "#1e1e2e", stroke: "#10b981", strokeWidth: 2, name: "Color 1" },
      { type: "ellipse", x: 848, y: 440, width: 36, height: 36, fill: "#10b981", name: "Color 2" },
      { type: "ellipse", x: 896, y: 440, width: 36, height: 36, fill: "#e4e4e7", name: "Color 3" },
      // CTA
      { type: "rectangle", x: 800, y: 520, width: 320, height: 52, fill: "#10b981", cornerRadius: 12, name: "Add to Cart", elementRole: "button" },
      { type: "text", x: 892, y: 530, width: 140, height: 28, text: "Add to Cart", fontSize: 17, fontWeight: "600", fill: "#ffffff", name: "Cart CTA Text" },
      { type: "rectangle", x: 1136, y: 520, width: 52, height: 52, fill: "transparent", cornerRadius: 12, stroke: "#52525b", strokeWidth: 2, name: "Wishlist Btn", elementRole: "button" },
    ],
  },
  "blog": {
    name: "Blog Layout",
    elements: [
      { type: "frame", x: 0, y: 0, width: 1440, height: 1200, fill: "#0f0f12", stroke: "transparent", name: "Blog Page", cornerRadius: 0 },
      // Header
      { type: "rectangle", x: 0, y: 0, width: 1440, height: 64, fill: "#111116", name: "Header" },
      { type: "text", x: 80, y: 18, width: 120, height: 28, text: "BLOG", fontSize: 22, fontWeight: "700", fill: "#10b981", name: "Logo" },
      { type: "rectangle", x: 1260, y: 14, width: 120, height: 36, fill: "#10b981", cornerRadius: 8, name: "Subscribe Btn", elementRole: "button" },
      { type: "text", x: 1277, y: 20, width: 86, height: 24, text: "Subscribe", fontSize: 14, fontWeight: "600", fill: "#ffffff", name: "Subscribe Text" },
      // Featured article
      { type: "rectangle", x: 80, y: 100, width: 880, height: 400, fill: "#1a1a1f", cornerRadius: 16, name: "Featured Image" },
      { type: "rectangle", x: 100, y: 420, width: 100, height: 28, fill: "#064e3b", cornerRadius: 14, name: "Featured Tag" },
      { type: "text", x: 112, y: 424, width: 76, height: 20, text: "Featured", fontSize: 12, fontWeight: "600", fill: "#10b981", name: "Featured Tag Text" },
      { type: "text", x: 80, y: 470, width: 840, height: 40, text: "The Future of Design: AI-Powered Tools", fontSize: 32, fontWeight: "700", fill: "#ffffff", name: "Featured Title" },
      { type: "text", x: 80, y: 520, width: 840, height: 48, text: "How artificial intelligence is transforming the way designers create, iterate, and ship products faster than ever before.", fontSize: 16, fontWeight: "400", fill: "#a1a1aa", name: "Featured Excerpt" },
      { type: "text", x: 80, y: 580, width: 200, height: 20, text: "Mar 15, 2024 · 8 min read", fontSize: 13, fontWeight: "400", fill: "#52525b", name: "Featured Meta" },
      // Sidebar
      { type: "text", x: 1000, y: 100, width: 360, height: 28, text: "Trending", fontSize: 20, fontWeight: "600", fill: "#ffffff", name: "Sidebar Title" },
      { type: "rectangle", x: 1000, y: 144, width: 360, height: 80, fill: "#1a1a1f", cornerRadius: 10, name: "Trending 1" },
      { type: "text", x: 1020, y: 156, width: 320, height: 20, text: "Getting Started with Atelier", fontSize: 15, fontWeight: "500", fill: "#e4e4e7", name: "Trending 1 Title" },
      { type: "text", x: 1020, y: 182, width: 200, height: 18, text: "5 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Trending 1 Meta" },
      { type: "rectangle", x: 1000, y: 236, width: 360, height: 80, fill: "#1a1a1f", cornerRadius: 10, name: "Trending 2" },
      { type: "text", x: 1020, y: 248, width: 320, height: 20, text: "Design Tokens Best Practices", fontSize: 15, fontWeight: "500", fill: "#e4e4e7", name: "Trending 2 Title" },
      { type: "text", x: 1020, y: 274, width: 200, height: 18, text: "12 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Trending 2 Meta" },
      { type: "rectangle", x: 1000, y: 328, width: 360, height: 80, fill: "#1a1a1f", cornerRadius: 10, name: "Trending 3" },
      { type: "text", x: 1020, y: 340, width: 320, height: 20, text: "Voice Design: The Next Frontier", fontSize: 15, fontWeight: "500", fill: "#e4e4e7", name: "Trending 3 Title" },
      { type: "text", x: 1020, y: 366, width: 200, height: 18, text: "7 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Trending 3 Meta" },
      // Article grid
      { type: "text", x: 80, y: 640, width: 300, height: 28, text: "Latest Articles", fontSize: 22, fontWeight: "600", fill: "#ffffff", name: "Grid Title" },
      { type: "rectangle", x: 80, y: 690, width: 400, height: 240, fill: "#1a1a1f", cornerRadius: 12, name: "Article 1 Image" },
      { type: "text", x: 80, y: 944, width: 400, height: 24, text: "Component Libraries That Scale", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Article 1 Title" },
      { type: "text", x: 80, y: 974, width: 400, height: 18, text: "Mar 12 · 6 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Article 1 Meta" },
      { type: "rectangle", x: 520, y: 690, width: 400, height: 240, fill: "#1a1a1f", cornerRadius: 12, name: "Article 2 Image" },
      { type: "text", x: 520, y: 944, width: 400, height: 24, text: "From Figma to Code in Seconds", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Article 2 Title" },
      { type: "text", x: 520, y: 974, width: 400, height: 18, text: "Mar 10 · 4 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Article 2 Meta" },
      { type: "rectangle", x: 960, y: 690, width: 400, height: 240, fill: "#1a1a1f", cornerRadius: 12, name: "Article 3 Image" },
      { type: "text", x: 960, y: 944, width: 400, height: 24, text: "Dark Mode Design Patterns", fontSize: 18, fontWeight: "600", fill: "#ffffff", name: "Article 3 Title" },
      { type: "text", x: 960, y: 974, width: 400, height: 18, text: "Mar 8 · 9 min read", fontSize: 12, fontWeight: "400", fill: "#52525b", name: "Article 3 Meta" },
    ],
  },
};

const AI_SYSTEM_PROMPT = `You are Atelier's design AI. You generate UI designs as JSON arrays of design elements.

Each element has these properties:
- type: "rectangle" | "ellipse" | "line" | "text" | "frame" | "image"
- x, y: position in pixels (canvas is 1440px wide)
- width, height: size in pixels
- fill: hex color string (e.g. "#10b981") or "transparent"
- stroke: hex color or "transparent"
- strokeWidth: number (0 for none)
- cornerRadius: number (0 for sharp)
- opacity: 0-1
- name: descriptive label (e.g. "Hero Title", "Nav Bar")
- text: (for type "text") the text content
- fontSize: (for type "text") size in px
- fontWeight: "300" | "400" | "500" | "600" | "700" | "800"
- fill: (for text) this is the text color
- parentId: null (for top-level) or parent element's name (for nesting in frames)
- elementRole: "auto" | "button" | "link" | "input" | "container" | "heading" | "image"

Design guidelines:
- Use a dark theme with background #0f0f12, cards #1a1a1f, borders #2a2a32
- Primary accent: #10b981 (indigo), secondary: #34d399 (violet)
- Text: #ffffff for headings, #e4e4e7 for body, #71717a for muted, #a1a1aa for descriptions
- Success: #4ade80, Warning: #fbbf24, Error: #f87171
- Standard widths: 1440px (desktop), 390px (mobile)
- Use "frame" type for sections/containers
- Set elementRole for interactive elements (buttons, links, inputs)
- Create realistic, production-quality designs with proper spacing and hierarchy

IMPORTANT: Return ONLY a JSON array of element objects. No markdown, no explanation, just the JSON array.`;

export default class AiServiceService extends Service {
  @service declare designStore: DesignStoreService;

  @tracked lastPrompt: string = "";
  @tracked conversationHistory: ConversationMessage[] = [];
  @tracked showConversation: boolean = false;
  @tracked agentSteps: AgentStep[] = [];
  @tracked showAgentLog: boolean = false;
  @tracked selectedModel: string = "atelier-v1";
  @tracked apiKey: string = "";
  @tracked showApiKeyModal: boolean = false;

  constructor(properties: object | undefined) {
    super(properties);
    // Load API key from localStorage
    this.apiKey = localStorage.getItem("atelier-api-key") ?? "";
  }

  get hasApiKey(): boolean {
    return this.apiKey.trim().length > 0;
  }

  setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (key.trim()) {
      localStorage.setItem("atelier-api-key", key.trim());
    } else {
      localStorage.removeItem("atelier-api-key");
    }
  }

  get availableTemplates(): string[] {
    return Object.keys(TEMPLATES);
  }

  private async addAgentStep(message: string): Promise<void> {
    this.agentSteps = [...this.agentSteps, { message, status: "pending" }];
    await new Promise((resolve) => setTimeout(resolve, 400));
    this.agentSteps = this.agentSteps.map((step, i) =>
      i === this.agentSteps.length - 1 ? { ...step, status: "complete" as const } : step,
    );
  }

  async generateFromPrompt(prompt: string): Promise<void> {
    this.lastPrompt = prompt;
    this.designStore.aiGenerating = true;
    this.agentSteps = [];
    this.showAgentLog = true;

    this.conversationHistory = [
      ...this.conversationHistory,
      { role: "user", content: prompt, timestamp: new Date() },
    ];

    await this.addAgentStep("Analyzing prompt...");

    // Try Claude API if key is available and Pro model selected
    if (this.hasApiKey && this.selectedModel === "atelier-pro") {
      try {
        await this.generateWithClaude(prompt);
        return;
      } catch (e) {
        console.error("Claude API failed, falling back to templates:", e);
        await this.addAgentStep("API unavailable, using templates...");
      }
    }

    // Fallback: template matching
    await this.generateFromTemplate(prompt);
  }

  private async generateWithClaude(prompt: string): Promise<void> {
    await this.addAgentStep("Connecting to Claude...");

    // Build messages from conversation history for context
    const messages = this.conversationHistory.slice(-6).map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    // Ensure the last message is the current prompt
    if (messages.length === 0 || messages[messages.length - 1]!.content !== prompt) {
      messages.push({ role: "user", content: `Generate a UI design for: ${prompt}` });
    }

    await this.addAgentStep("Generating with Claude...");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: AI_SYSTEM_PROMPT,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text ?? "";

    await this.addAgentStep("Parsing design elements...");

    // Extract JSON array from response (handle possible markdown wrapping)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const elements: Partial<DesignElement>[] = JSON.parse(jsonStr);

    if (!Array.isArray(elements) || elements.length === 0) {
      throw new Error("Invalid response: not an array of elements");
    }

    await this.addAgentStep(`Placing ${elements.length} elements...`);

    this.designStore.pushHistory();
    this.designStore.clearCanvas();

    const batchSize = 5;
    for (let i = 0; i < elements.length; i += batchSize) {
      const batch = elements.slice(i, i + batchSize);
      for (const elData of batch) {
        this.designStore.createElement(elData.type as DesignElement["type"], elData);
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }

    await this.addAgentStep("Generation complete");

    const assistantContent = `Generated ${elements.length} elements from AI.`;
    this.conversationHistory = [
      ...this.conversationHistory,
      { role: "assistant", content: assistantContent, timestamp: new Date() },
    ];

    this.designStore.aiGenerating = false;
    this.designStore.showAiModal = false;
    setTimeout(() => { this.designStore.zoomToFit(); }, 100);
    setTimeout(() => { this.showAgentLog = false; }, 3000);
  }

  private async generateFromTemplate(prompt: string): Promise<void> {
    const lowerPrompt = prompt.toLowerCase();
    let bestMatch = "landing page";

    if (lowerPrompt.includes("mobile") || lowerPrompt.includes("app") || lowerPrompt.includes("phone") || lowerPrompt.includes("ios") || lowerPrompt.includes("android")) {
      bestMatch = "mobile app";
    } else if (lowerPrompt.includes("dashboard") || lowerPrompt.includes("admin") || lowerPrompt.includes("analytics") || lowerPrompt.includes("data") || lowerPrompt.includes("chart")) {
      bestMatch = "dashboard";
    } else if (lowerPrompt.includes("pricing") || lowerPrompt.includes("plan") || lowerPrompt.includes("subscription")) {
      bestMatch = "pricing page";
    } else if (lowerPrompt.includes("signup") || lowerPrompt.includes("sign up") || lowerPrompt.includes("login") || lowerPrompt.includes("register") || lowerPrompt.includes("auth")) {
      bestMatch = "signup";
    } else if (lowerPrompt.includes("product") || lowerPrompt.includes("ecommerce") || lowerPrompt.includes("e-commerce") || lowerPrompt.includes("shop") || lowerPrompt.includes("store")) {
      bestMatch = "ecommerce";
    } else if (lowerPrompt.includes("blog") || lowerPrompt.includes("article") || lowerPrompt.includes("post") || lowerPrompt.includes("content")) {
      bestMatch = "blog";
    }

    await this.addAgentStep(`Selecting template: ${TEMPLATES[bestMatch]!.name}...`);
    await this.addAgentStep("Generating layout...");

    const template = TEMPLATES[bestMatch]!;
    this.designStore.pushHistory();
    this.designStore.clearCanvas();

    await this.addAgentStep("Placing elements...");

    const batchSize = 5;
    for (let i = 0; i < template.elements.length; i += batchSize) {
      const batch = template.elements.slice(i, i + batchSize);
      for (const elData of batch) {
        this.designStore.createElement(elData.type as DesignElement["type"], elData);
      }
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    await this.addAgentStep("Applying styles...");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await this.addAgentStep("Generation complete");

    const elementCount = template.elements.length;
    const typeBreakdown: Record<string, number> = {};
    for (const el of template.elements) {
      const t = el.type || "unknown";
      typeBreakdown[t] = (typeBreakdown[t] || 0) + 1;
    }
    const breakdown = Object.entries(typeBreakdown)
      .map(([type, count]) => `${count} ${type}${count > 1 ? "s" : ""}`)
      .join(", ");

    const assistantContent = `Generated a ${template.name.toLowerCase()} with ${elementCount} elements including ${breakdown}.`;

    this.conversationHistory = [
      ...this.conversationHistory,
      { role: "assistant", content: assistantContent, timestamp: new Date() },
    ];

    this.designStore.aiGenerating = false;
    this.designStore.showAiModal = false;
    setTimeout(() => { this.designStore.zoomToFit(); }, 100);
    setTimeout(() => { this.showAgentLog = false; }, 3000);
  }
}
