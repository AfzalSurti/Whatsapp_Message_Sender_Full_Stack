const { validationResult } = require('express-validator');
const Contact = require('../models/Contact');
const { normalizePhoneNumber } = require('../utils/phone');

const getContacts = async (req, res) => {
  try {
    const contacts = await Contact.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ contacts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createContact = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, phoneNumber } = req.body;
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return res.status(400).json({ error: 'Enter a valid international phone number' });
    }

    const contact = await Contact.create({
      userId: req.user._id,
      name,
      phoneNumber: normalized.e164
    });

    res.status(201).json({ contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateContact = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { name, phoneNumber } = req.body;
    const normalized = normalizePhoneNumber(phoneNumber);

    if (!normalized) {
      return res.status(400).json({ error: 'Enter a valid international phone number' });
    }

    const contact = await Contact.findOneAndUpdate(
      { _id: id, userId: req.user._id },
      { name, phoneNumber: normalized.e164 },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const contact = await Contact.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getContacts, createContact, updateContact, deleteContact };
