const BulletinPost = require('../models/BulletinPost');
const notificationService = require('../services/notificationService');

// Create post (admin)
exports.createPost = async (req, res) => {
  try {
    const { title, body } = req.body;
    const images = req.files ? req.files.map(f => `/uploads/${f.filename}`) : [];
    const post = new BulletinPost({
      title,
      body,
      images,
      organization: req.user.organization,
      createdBy: req.user._id,
    });
    await post.save();
    // Notify all users (including custom admins)
    await notificationService.notifyAllUsers({
      organization: req.user.organization,
      message: `${req.user.fullName} posted a new bulletin: ${title}`,
      type: 'bulletin',
      link: '/bulletin-board',
      sender: req.user._id
    });
    res.status(201).json(post);
  } catch (err) {
    console.error('Error creating bulletin post:', err);
    res.status(500).json({ message: 'Failed to create post', error: err.message });
  }
};

// Update post (admin)
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body } = req.body;
    let update = { title, body };
    if (req.files && req.files.length > 0) {
      update.images = req.files.map(f => `/uploads/${f.filename}`);
    }
    const post = await BulletinPost.findOneAndUpdate(
      { _id: id, organization: req.user.organization },
      update,
      { new: true }
    );
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (err) {
    console.error('Error updating bulletin post:', err);
    res.status(500).json({ message: 'Failed to update post', error: err.message });
  }
};

// Delete post (admin)
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BulletinPost.findOneAndDelete({
      _id: id,
      organization: req.user.organization
    });
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json({ message: 'Post deleted' });
  } catch (err) {
    console.error('Error deleting bulletin post:', err);
    res.status(500).json({ message: 'Failed to delete post', error: err.message });
  }
};

// List all posts (admin & staff)
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await BulletinPost.find({ organization: req.user.organization })
      .populate('createdBy', 'fullName')
      .sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    console.error('Error fetching bulletin posts:', err);
    res.status(500).json({ message: 'Failed to fetch posts', error: err.message });
  }
};

// Get single post (admin & staff)
exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await BulletinPost.findOne({
      _id: id,
      organization: req.user.organization
    }).populate('createdBy', 'fullName');
    if (!post) return res.status(404).json({ message: 'Post not found' });
    res.json(post);
  } catch (err) {
    console.error('Error fetching bulletin post:', err);
    res.status(500).json({ message: 'Failed to fetch post', error: err.message });
  }
}; 