# Components

## LeaveFilterBar

A modern, reusable filter component for leave history screens with search functionality and status filter chips.

## ClaimsFilterBar

A modern, reusable filter component for claims history screens with search functionality and status filter chips.

### Features

- **Modern Design**: Clean card-style layout with rounded corners and subtle shadows
- **Search Bar**: Rounded search input with magnify icon and optional filter button
- **Status Filter Chips**: Horizontally scrollable filter chips with active/inactive states
- **Theme Support**: Fully integrated with the app's theme system
- **Touch Friendly**: Optimized for mobile touch interactions
- **Accessible**: Proper accessibility labels and touch targets

### Props

```typescript
interface LeaveFilterBarProps {
  activeStatus: string;           // Currently selected status filter
  onStatusChange: (status: string) => void;  // Callback when status changes
  searchQuery: string;           // Current search query
  onSearchChange: (query: string) => void;   // Callback when search changes
  onFilterPress?: () => void;    // Optional callback for advanced filters
}
```

### Usage

```tsx
import LeaveFilterBar from '../components/LeaveFilterBar';

const LeaveHistoryScreen = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  return (
    <LeaveFilterBar
      activeStatus={status}
      onStatusChange={setStatus}
      searchQuery={search}
      onSearchChange={setSearch}
      onFilterPress={handleFilterPress}
    />
  );
};
```

### Status Options

The component includes the following predefined status options:
- **All**: Shows all leave requests (empty value)
- **Pending**: Shows only pending requests
- **Approved**: Shows only approved requests  
- **Rejected**: Shows only rejected requests

### Styling

The component uses the app's theme system and includes:
- Card elevation with shadow
- Rounded corners (16px border radius)
- Consistent padding and spacing
- Theme-aware colors for all states
- Responsive design for different screen sizes

### Future Enhancements

- Advanced filters modal/bottom sheet
- Date range picker
- Leave type filters
- Custom status options
- Animation support for filter transitions

---

## ClaimsFilterBar

A modern, reusable filter component for claims history screens with search functionality and status filter chips.

### Features

- **Modern Design**: Clean card-style layout with rounded corners and subtle shadows
- **Search Bar**: Rounded search input with magnify icon and optional filter button
- **Status Filter Chips**: Horizontally scrollable filter chips with active/inactive states
- **Theme Support**: Fully integrated with the app's theme system
- **Touch Friendly**: Optimized for mobile touch interactions
- **Accessible**: Proper accessibility labels and touch targets

### Props

```typescript
interface ClaimsFilterBarProps {
  activeStatus: string;           // Currently selected status filter
  onStatusChange: (status: string) => void;  // Callback when status changes
  searchQuery: string;           // Current search query
  onSearchChange: (query: string) => void;   // Callback when search changes
  onFilterPress?: () => void;    // Optional callback for advanced filters
}
```

### Usage

```tsx
import ClaimsFilterBar from '../components/ClaimsFilterBar';

const ClaimsHistoryScreen = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  return (
    <ClaimsFilterBar
      activeStatus={status}
      onStatusChange={setStatus}
      searchQuery={search}
      onSearchChange={setSearch}
      onFilterPress={handleFilterPress}
    />
  );
};
```

### Status Options

The component includes the following predefined status options:
- **All**: Shows all expense claims (empty value)
- **Pending**: Shows only pending claims
- **Approved**: Shows only approved claims  
- **Rejected**: Shows only rejected claims

### Styling

The component uses the app's theme system and includes:
- Card elevation with shadow
- Rounded corners (16px border radius)
- Consistent padding and spacing
- Theme-aware colors for all states
- Responsive design for different screen sizes

### Future Enhancements

- Advanced filters modal/bottom sheet
- Date range picker
- Claim type filters
- Amount range filters
- Custom status options
- Animation support for filter transitions

---

## TrainingFilterBar

A modern, reusable filter component for training history screens with search functionality and status filter chips.

### Features

- **Modern Design**: Clean card-style layout with rounded corners and subtle shadows
- **Search Bar**: Rounded search input with magnify icon and optional filter button
- **Status Filter Chips**: Horizontally scrollable filter chips with active/inactive states
- **Theme Support**: Fully integrated with the app's theme system
- **Touch Friendly**: Optimized for mobile touch interactions
- **Accessible**: Proper accessibility labels and touch targets

### Props

```typescript
interface TrainingFilterBarProps {
  activeStatus: string;           // Currently selected status filter
  onStatusChange: (status: string) => void;  // Callback when status changes
  searchQuery: string;           // Current search query
  onSearchChange: (query: string) => void;   // Callback when search changes
  onFilterPress?: () => void;    // Optional callback for advanced filters
}
```

### Usage

```tsx
import TrainingFilterBar from '../components/TrainingFilterBar';

const TrainingHistoryScreen = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  return (
    <TrainingFilterBar
      activeStatus={status}
      onStatusChange={setStatus}
      searchQuery={search}
      onSearchChange={setSearch}
      onFilterPress={handleFilterPress}
    />
  );
};
```

### Status Options

The component includes the following predefined status options:
- **All**: Shows all training requests (empty value)
- **Pending**: Shows only pending requests
- **Approved**: Shows only approved requests  
- **Rejected**: Shows only rejected requests

### Styling

The component uses the app's theme system and includes:
- Card elevation with shadow
- Rounded corners (16px border radius)
- Consistent padding and spacing
- Theme-aware colors for all states
- Responsive design for different screen sizes

### Future Enhancements

- Advanced filters modal/bottom sheet
- Date range picker
- Training type filters
- Cost range filters
- Custom status options
- Animation support for filter transitions

---

## InventoryFilterBar

A modern, reusable filter component for inventory screens with search functionality and status filter chips.

### Features

- **Modern Design**: Clean card-style layout with rounded corners and subtle shadows
- **Search Bar**: Rounded search input with magnify icon and optional filter button
- **Status Filter Chips**: Horizontally scrollable filter chips with active/inactive states
- **Theme Support**: Fully integrated with the app's theme system
- **Touch Friendly**: Optimized for mobile touch interactions
- **Accessible**: Proper accessibility labels and touch targets

### Props

```typescript
interface InventoryFilterBarProps {
  activeStatus: string;           // Currently selected status filter
  onStatusChange: (status: string) => void;  // Callback when status changes
  searchQuery: string;           // Current search query
  onSearchChange: (query: string) => void;   // Callback when search changes
  onFilterPress?: () => void;    // Optional callback for advanced filters
}
```

### Usage

```tsx
import InventoryFilterBar from '../components/InventoryFilterBar';

const CurrentInventoryScreen = () => {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleFilterPress = () => {
    // TODO: Implement advanced filters modal/bottom sheet
    console.log('Advanced filters pressed');
  };

  return (
    <InventoryFilterBar
      activeStatus={status}
      onStatusChange={setStatus}
      searchQuery={search}
      onSearchChange={setSearch}
      onFilterPress={handleFilterPress}
    />
  );
};
```

### Status Options

The component includes the following predefined status options:
- **All**: Shows all inventory items (empty value)
- **Assigned**: Shows only assigned items
- **In Stock**: Shows only items in stock

### Styling

The component uses the app's theme system and includes:
- Card elevation with shadow
- Rounded corners (16px border radius)
- Consistent padding and spacing
- Theme-aware colors for all states
- Responsive design for different screen sizes

### Future Enhancements

- Advanced filters modal/bottom sheet
- Category filters
- Date range filters
- Quantity range filters
- Custom status options
- Animation support for filter transitions

---

# Screens

## ExpenseClaimScreen

A modern, user-friendly expense claim form with improved UI/UX design following mobile best practices.

### Features

- **Sectioned Layout**: Form is organized into three clear sections:
  - Claim Details (Title, Date, Category)
  - Itemized Expenses (Card-style expense entries)
  - Justification & Attachments (Notes and document uploads)
- **Modern Input Design**: Rounded inputs with icons and proper spacing
- **Category Dropdown**: Replaced chip selection with a clean dropdown menu
- **Card-Style Expenses**: Each expense item is displayed as a card with proper spacing
- **Document Management**: Modern file attachment interface with file type icons
- **Sticky Footer**: Action buttons are always accessible at the bottom
- **Keyboard Aware**: Proper keyboard handling for better mobile experience
- **Theme Integration**: Fully integrated with the app's theme system

### Form Sections

#### 1. Claim Details
- **Claim Title**: Required text input with outlined design
- **Expense Date**: Date picker with calendar icon
- **Category**: Dropdown menu with tag icon and chevron

#### 2. Itemized Expenses
- **Add Item Button**: Dashed border button to add new expense items
- **Expense Cards**: Each item displayed as a card with:
  - Item number header
  - Description field (required)
  - Amount field with currency (required)
  - Notes field (optional)
  - Delete button (if more than one item)
- **Total Amount**: Highlighted total calculation card

#### 3. Justification & Attachments
- **Justification Textarea**: Multi-line input for notes
- **Document Attachment**: Modern button-style picker
- **Document List**: File cards with type icons and remove options
- **Declaration Checkbox**: Larger, more accessible checkbox

### UI Improvements

- **Consistent Spacing**: 16px spacing between sections
- **Rounded Corners**: 12px border radius for modern look
- **Card Elevation**: Subtle shadows for depth
- **Icon Integration**: Meaningful icons throughout the interface
- **Color Hierarchy**: Clear visual hierarchy with primary/secondary colors
- **Touch Targets**: Properly sized touch areas for mobile

### Action Buttons

- **Save as Draft**: Outlined button for saving progress
- **Submit Claim**: Primary filled button for final submission
- **Sticky Footer**: Buttons always visible at bottom of screen

### Document Management

- **File Type Icons**: Different icons for PDF, images, documents, etc.
- **Attachment Modal**: Clean modal for selecting documents
- **Visual Feedback**: Clear indication of attached documents
- **Remove Option**: Easy removal of attached documents

### Validation & Error Handling

- **Real-time Validation**: Immediate feedback on required fields
- **Error Display**: Card-style error messages
- **Success Feedback**: Success message on successful submission
- **Loading States**: Proper loading indicators during submission

### Accessibility

- **Proper Labels**: Clear labels for all form elements
- **Touch Targets**: Adequate size for all interactive elements
- **Color Contrast**: Proper contrast ratios for text readability
- **Screen Reader Support**: Proper accessibility labels

### Future Enhancements

- **Draft Auto-save**: Automatic saving of form progress
- **Image Capture**: Direct camera integration for receipts
- **OCR Integration**: Automatic text extraction from receipts
- **Advanced Validation**: More sophisticated validation rules
- **Offline Support**: Form submission when offline
- **Template Support**: Pre-filled templates for common expenses

---

## TrainingRequestScreen

A modern, user-friendly training request form with improved UI/UX design following mobile best practices.

### Features

- **Sectioned Layout**: Form is organized into four clear sections:
  - Training Details (Title, Host, Location, Duration)
  - Cost Breakdown (Detailed cost analysis with total calculation)
  - Justification & Requirements (Business case and outcomes)
  - Supporting Documents (File attachments)
- **Modern Input Design**: Rounded inputs with proper spacing and validation
- **Cost Calculator**: Real-time total cost calculation from all expense categories
- **Document Management**: Modern file attachment interface with file type icons
- **Sticky Footer**: Action buttons are always accessible at the bottom
- **Keyboard Aware**: Proper keyboard handling for better mobile experience
- **Theme Integration**: Fully integrated with the app's theme system

### Form Sections

#### 1. Training Details
- **Training Title**: Required text input with outlined design
- **Hosted By**: Organization or institution hosting the training
- **Training Location**: Physical or virtual location
- **Number of Days**: Duration of the training program

#### 2. Cost Breakdown
- **Training Fee**: Registration or course fee
- **Travel Cost**: Transportation expenses
- **Accommodation**: Hotel or lodging costs
- **Meal Cost**: Food and per diem expenses
- **Other Costs**: Additional expenses with description
- **Total Calculation**: Real-time sum of all costs

#### 3. Justification & Requirements
- **Training Justification**: Business case for the training
- **Expected Outcomes**: What skills/knowledge will be gained
- **Benefit to Organization**: How the organization will benefit
- **Cover Requirements**: Who will cover duties during training
- **Additional Notes**: Optional supplementary information

#### 4. Supporting Documents
- **Document Attachment**: Modern button-style picker
- **Document List**: File cards with type icons and remove options
- **File Type Detection**: Automatic icon selection based on file type

### UI Improvements

- **Consistent Spacing**: 16px spacing between sections
- **Rounded Corners**: 12px border radius for modern look
- **Card Elevation**: Subtle shadows for depth
- **Icon Integration**: Meaningful icons throughout the interface
- **Color Hierarchy**: Clear visual hierarchy with primary/secondary colors
- **Touch Targets**: Properly sized touch areas for mobile

### Cost Management

- **Real-time Calculation**: Automatic total cost updates
- **Currency Support**: Dynamic currency display based on system settings
- **Cost Categories**: Organized breakdown of different expense types
- **Visual Total**: Highlighted total cost card for quick reference

### Action Buttons

- **Save as Draft**: Outlined button for saving progress
- **Submit Request**: Primary filled button for final submission
- **Sticky Footer**: Buttons always visible at bottom of screen

### Document Management

- **File Type Icons**: Different icons for PDF, images, documents, etc.
- **Attachment Modal**: Clean modal for selecting documents
- **Visual Feedback**: Clear indication of attached documents
- **Remove Option**: Easy removal of attached documents

### Validation & Error Handling

- **Real-time Validation**: Immediate feedback on required fields
- **Error Display**: Card-style error messages
- **Success Feedback**: Success message on successful submission
- **Loading States**: Proper loading indicators during submission

### Accessibility

- **Proper Labels**: Clear labels for all form elements
- **Touch Targets**: Adequate size for all interactive elements
- **Color Contrast**: Proper contrast ratios for text readability
- **Screen Reader Support**: Proper accessibility labels

### Future Enhancements

- **Draft Auto-save**: Automatic saving of form progress
- **Training Templates**: Pre-filled templates for common training types
- **Cost Estimation Tools**: Built-in cost calculators for different training types
- **Advanced Validation**: More sophisticated validation rules
- **Offline Support**: Form submission when offline
- **Training Calendar Integration**: Link to training schedules
- **Approval Workflow**: Multi-level approval process
- **Budget Tracking**: Integration with organizational budget systems

---

## InventoryRequestScreen

A modern, user-friendly inventory request form with improved UI/UX design following mobile best practices.

### Features

- **Sectioned Layout**: Form is organized into three clear sections:
  - Item Details (Item selection, category, quantity)
  - Request Details (Required date, justification)
  - Request Summary (Overview of all entered information)
- **Modern Input Design**: Rounded inputs with proper spacing and validation
- **Item Selection**: Dropdown menu for selecting from available inventory items
- **Category Auto-population**: Automatic category assignment based on selected item
- **Request Summary**: Visual overview of all entered information
- **Sticky Footer**: Action buttons are always accessible at the bottom
- **Keyboard Aware**: Proper keyboard handling for better mobile experience
- **Theme Integration**: Fully integrated with the app's theme system

### Form Sections

#### 1. Item Details
- **Item Selection**: Dropdown menu with package icon and chevron
- **Category**: Auto-populated field with tag icon
- **Quantity**: Numeric input with quantity icon

#### 2. Request Details
- **Required Date**: Date picker with calendar icon
- **Justification**: Multi-line textarea for business case

#### 3. Request Summary
- **Visual Overview**: Card-style summary of all entered information
- **Icons**: Meaningful icons for each field type
- **Real-time Updates**: Summary updates as form is filled

### UI Improvements

- **Consistent Spacing**: 16px spacing between sections
- **Rounded Corners**: 12px border radius for modern look
- **Card Elevation**: Subtle shadows for depth
- **Icon Integration**: Meaningful icons throughout the interface
- **Color Hierarchy**: Clear visual hierarchy with primary/secondary colors
- **Touch Targets**: Properly sized touch areas for mobile

### Item Management

- **Smart Selection**: Dropdown with category icons for different item types
- **Auto-categorization**: Automatic category assignment
- **Quantity Validation**: Ensures positive numbers only
- **Visual Feedback**: Clear indication of selected items

### Action Buttons

- **Submit Request**: Primary filled button for final submission
- **Sticky Footer**: Button always visible at bottom of screen

### Validation & Error Handling

- **Real-time Validation**: Immediate feedback on required fields
- **Error Display**: Card-style error messages
- **Success Feedback**: Success message on successful submission
- **Loading States**: Proper loading indicators during submission

### Accessibility

- **Proper Labels**: Clear labels for all form elements
- **Touch Targets**: Adequate size for all interactive elements
- **Color Contrast**: Proper contrast ratios for text readability
- **Screen Reader Support**: Proper accessibility labels

### Future Enhancements

- **Draft Auto-save**: Automatic saving of form progress
- **Item Templates**: Pre-filled templates for common items
- **Bulk Requests**: Multiple item requests in one form
- **Advanced Validation**: More sophisticated validation rules
- **Offline Support**: Form submission when offline
- **Inventory Integration**: Real-time stock level checking
- **Approval Workflow**: Multi-level approval process
- **Budget Tracking**: Integration with organizational budget systems

---

## DashboardScreen

A comprehensive dashboard that provides users with an overview of their work status, recent activities, and quick access to key features.

### Features

- **Welcome Header**: Personalized greeting with user name and current date
- **Attendance Management**: Real-time check-in/check-out functionality with location tracking
- **Peer Recognitions**: Recent peer recognition posts with user interactions
- **Bulletin Board**: Latest company announcements and important updates
- **Quick Actions**: Fast access to commonly used features
- **Pull-to-Refresh**: Swipe down to refresh all dashboard data
- **Theme Integration**: Fully integrated with the app's theme system

### Dashboard Sections

#### 1. Welcome Header
- **Personalized Greeting**: Shows user's full name
- **Current Date**: Formatted date display
- **User Avatar**: Initials-based avatar with theme colors

#### 2. Today's Attendance
- **Check-in/Check-out Button**: Dynamic button that changes based on current status
- **Time Display**: Shows check-in and check-out times
- **Status Indicator**: Clear indication of current attendance status
- **Location Tracking**: GPS-based attendance verification

#### 3. Peer Recognitions
- **Recent Posts**: Shows the 3 most recent peer recognition posts
- **User Interactions**: Displays who recognized whom with comments
- **Date Stamps**: Shows when each recognition was posted
- **Empty State**: "No recognitions yet" message when no data available

#### 4. Bulletin Board
- **Latest Announcements**: Shows the 3 most recent bulletins posted by admin users
- **Compact Cards**: Each bulletin displayed as a card with:
  - Title (bold, truncated to 2 lines)
  - Posted by (admin name)
  - Posted date (formatted as relative time)
  - Content preview (first sentence or 100 characters)
  - "Read More" link for longer content
- **View All Button**: Navigation to full bulletin board
- **Empty State**: "No bulletins yet" message when no bulletins available

#### 5. Quick Actions
- **Training Request**: Navigate to training request form
- **Inventory Request**: Navigate to inventory request form
- **Payslip**: Access to payslip information
- **Expense Claim**: Navigate to expense claim form

### Bulletin Board Features

#### Content Display
- **Smart Truncation**: Shows first sentence or first 100 characters
- **Read More Link**: Tappable text that navigates to full bulletin
- **Date Formatting**: Relative dates (Yesterday, X days ago, etc.)
- **Author Display**: Shows admin name who posted the bulletin

#### Navigation
- **Individual Bulletin**: Tap any bulletin card to view full content
- **View All**: Button to navigate to complete bulletin board
- **Deep Linking**: Support for direct navigation to specific bulletins

#### Styling
- **Compact Cards**: Soft shadow and rounded corners
- **Adequate Spacing**: Proper padding and margins
- **Light Background**: Subtle background color for cards
- **Text Truncation**: Keeps preview neat and mobile-friendly
- **Theme Colors**: Consistent with app's design system

### Data Management

#### API Integration
- **Bulletin Fetching**: `apiService.getBulletins({ limit: 3 })`
- **Real-time Updates**: Pull-to-refresh functionality
- **Error Handling**: Graceful fallback when API calls fail
- **Loading States**: Activity indicators during data loading

#### Performance
- **Limited Results**: Only fetches 3 most recent bulletins
- **Efficient Rendering**: Optimized for mobile performance
- **Caching**: Reduces unnecessary API calls
- **Lazy Loading**: Loads data only when needed

### UI/UX Guidelines

#### Mobile Optimization
- **Responsive Design**: Adapts to different screen sizes
- **Touch Friendly**: Adequate touch targets for all interactive elements
- **Smooth Scrolling**: Optimized scroll performance
- **Loading States**: Clear feedback during data loading

#### Accessibility
- **Screen Reader Support**: Proper accessibility labels
- **Color Contrast**: Meets accessibility standards
- **Text Scaling**: Supports dynamic text sizing
- **Keyboard Navigation**: Full keyboard accessibility

#### Visual Design
- **Consistent Spacing**: 16px grid system throughout
- **Card Elevation**: Subtle shadows for depth
- **Icon Integration**: Meaningful icons for each section
- **Color Hierarchy**: Clear visual hierarchy with primary/secondary colors

### Future Enhancements

#### Bulletin Board
- **Push Notifications**: Real-time notifications for new bulletins
- **Categories**: Filter bulletins by category (General, Important, Events, etc.)
- **Search Functionality**: Search through bulletin content
- **Bookmarking**: Save important bulletins for later reference
- **Sharing**: Share bulletins with other team members
- **Rich Content**: Support for images, links, and formatted text
- **Comments**: Allow users to comment on bulletins
- **Read Receipts**: Track which users have read specific bulletins

#### Dashboard
- **Customizable Layout**: Allow users to reorder sections
- **Widget System**: Add/remove dashboard widgets
- **Dark Mode**: Enhanced dark mode support
- **Offline Support**: Cache dashboard data for offline viewing
- **Analytics**: Usage statistics and insights
- **Personalization**: Customizable dashboard based on user role