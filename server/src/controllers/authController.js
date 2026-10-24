const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.register = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').notEmpty().withMessage('Name is required').trim(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      
      const { name, email, password } = req.body;
      
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      
      const user = new User({
        name,
        email,
        password: hashedPassword
      });
      
      await user.save();
      
      // Do not return password or hash
      const userResponse = { id: user._id, name: user.name, email: user.email };
      
      // Token generation (optional on register, but good practice to auto-login)
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret_for_tests_only', { expiresIn: '1d' });
      
      res.status(201).json({ user: userResponse, token });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'User with this email already exists' });
      }
      console.error(err);
      res.status(500).json({ error: 'Server error during registration' });
    }
  }
];

exports.login = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      
      const { email, password } = req.body;
      
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const userResponse = { id: user._id, name: user.name, email: user.email };
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'fallback_secret_for_tests_only', { expiresIn: '1d' });
      
      res.status(200).json({ user: userResponse, token });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error during login' });
    }
  }
];
