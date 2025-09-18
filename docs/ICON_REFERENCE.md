# Icon Reference - Quick Guide

## 🎨 Available Menu Icons

Copy the exact icon name into your `cp_menuicon` field in the entity configuration.

### 👥 People & Users
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `users` | Multiple people | Teams, Groups, Communities |
| `user` | Single person | Profiles, Individual records |
| `user-circle` | Person in circle | User management, Accounts |

### 🏢 Buildings & Organizations  
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `building` | Office building | Companies, Departments |
| `office-building` | Detailed building | Corporate entities |
| `home` | House | Personal, Home office |

### 📄 Documents & Files
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `document` | Paper document | Files, Reports, Articles |
| `folder` | File folder | Categories, Collections |
| `clipboard` | Clipboard | Tasks, Checklists, Forms |

### 📊 Analytics & Charts  
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `chart-bar` | Bar chart | Analytics, Reports |
| `chart-pie` | Pie chart | Statistics, Breakdowns |
| `trending-up` | Trending arrow | Growth, Performance |

### 💬 Communication
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `mail` | Email envelope | Messages, Notifications |
| `chat` | Speech bubble | Discussions, Comments |
| `phone` | Telephone | Contacts, Support |

### ⚙️ Tools & Settings
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `cog` | Settings gear | Configuration, Admin |
| `wrench` | Tool wrench | Maintenance, Tools |

### 💼 Business & Finance
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `briefcase` | Business briefcase | Projects, Professional |
| `currency-dollar` | Dollar sign | Finance, Pricing |
| `credit-card` | Credit card | Payments, Billing |

### ✅ Actions & Status  
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `check-circle` | Success checkmark | Completed, Approved |
| `exclamation` | Warning triangle | Issues, Alerts |
| `bell` | Notification bell | Reminders, Alerts |

### 🎨 Creative & Media
| Icon Name | Description | Use For |
|-----------|-------------|---------|
| `camera` | Camera | Photos, Media |
| `photograph` | Picture frame | Gallery, Images |
| `star` | Star rating | Favorites, Reviews |

---

## 🎯 Quick Setup Examples

```json
// Ideas/Innovation
"cp_menuicon": "star"

// Projects  
"cp_menuicon": "briefcase"

// Team Management
"cp_menuicon": "users"

// Reports/Analytics
"cp_menuicon": "chart-bar"

// Support/Issues
"cp_menuicon": "exclamation"

// Settings/Admin
"cp_menuicon": "cog"
```

## 🔄 Testing Your Icon

1. Set `cp_menuicon` field in entity configuration
2. Click refresh button (🔄) in sidebar 
3. New icon appears immediately

**Default:** If no icon specified, uses document icon (📄)
