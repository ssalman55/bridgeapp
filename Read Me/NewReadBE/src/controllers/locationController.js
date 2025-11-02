const asyncHandler = require('express-async-handler');
const Location = require('../models/Location');

// GET /api/locations - List all locations
const getLocations = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const { search, capacity } = req.query;

  const filter = {
    organization: organizationId
  };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }

  if (capacity) {
    filter.capacity = { $gte: parseInt(capacity) };
  }

  const locations = await Location.find(filter)
    .populate('organization', 'name')
    .sort({ name: 1 });

  res.json(locations);
});

// GET /api/locations/:id - Get single location
const getLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id)
    .populate('organization', 'name');

  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  // Check if user can view this location
  if (location.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  res.json(location);
});

// POST /api/locations - Create new location
const createLocation = asyncHandler(async (req, res) => {
  const organizationId = req.user.organization._id;
  const locationData = req.body;

  const location = new Location({
    ...locationData,
    organization: organizationId
  });

  await location.save();

  await location.populate('organization', 'name');

  res.status(201).json(location);
});

// PUT /api/locations/:id - Update location
const updateLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);

  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  // Check permissions
  if (location.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const updateData = req.body;

  Object.assign(location, updateData);

  await location.save();

  await location.populate('organization', 'name');

  res.json(location);
});

// DELETE /api/locations/:id - Delete location
const deleteLocation = asyncHandler(async (req, res) => {
  const location = await Location.findById(req.params.id);

  if (!location) {
    return res.status(404).json({ message: 'Location not found' });
  }

  // Check permissions
  if (location.organization.toString() !== req.user.organization._id.toString()) {
    return res.status(403).json({ message: 'Access denied' });
  }

  await Location.findByIdAndDelete(req.params.id);

  res.json({ message: 'Location deleted successfully' });
});

module.exports = {
  getLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation
};





