import mongoose from "mongoose";
import Product from "../models/Product.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns true if `id` is a syntactically valid MongoDB ObjectId.
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Sends a consistent error response. Never exposes stack traces.
 */
const sendError = (res, statusCode, message) =>
  res.status(statusCode).json({ success: false, message });

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/products
 * Returns all products. Supports optional query filters:
 *   ?category=  ?featured=true  ?minPrice=  ?maxPrice=  ?search=
 */
export const getAllProducts = async (req, res) => {
  try {
    const { category, featured, minPrice, maxPrice, search } = req.query;
    const filter = {};

    if (category) filter.category = { $regex: category, $options: "i" };
    if (featured !== undefined) filter.featured = featured === "true";
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }
    if (search) {
      filter.$text = { $search: search };
    }

    const products = await Product.find(filter).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve products");
  }
};

/**
 * GET /api/products/:id
 * Returns a single product by MongoDB ObjectId.
 */
export const getProductById = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 400, `Invalid product ID: ${id}`);
  }

  try {
    const product = await Product.findById(id);

    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    res.status(200).json({ success: true, data: product });
  } catch (error) {
    sendError(res, 500, "Failed to retrieve product");
  }
};

/**
 * POST /api/products
 * Creates a new product. Required fields are enforced by the Mongoose schema.
 *
 * Security: only whitelisted fields are accepted from the request body.
 * System-managed fields (rating, _id, createdAt, etc.) cannot be injected.
 */
export const createProduct = async (req, res) => {
  try {
    // Explicit whitelist — never pass req.body directly to the model
    const {
      name,
      description,
      price,
      category,
      subcategory,
      image,
      images,
      sizes,
      colors,
      stock,
      featured,
    } = req.body;

    const product = await Product.create({
      name,
      description,
      price,
      category,
      subcategory,
      image,
      images,
      sizes,
      colors,
      stock,
      featured,
    });

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    // Mongoose validation errors — return field-level messages to the client
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, 400, messages.join(", "));
    }
    sendError(res, 500, "Failed to create product");
  }
};

/**
 * PUT /api/products/:id
 * Updates an existing product by ID.
 *
 * Security: only whitelisted fields are accepted from the request body.
 * rating, _id, createdAt, and other system fields cannot be overwritten.
 */
export const updateProduct = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 400, `Invalid product ID: ${id}`);
  }

  // Prevent negative price / stock before reaching the model
  if (req.body.price !== undefined && Number(req.body.price) < 0) {
    return sendError(res, 400, "Price cannot be negative");
  }
  if (req.body.stock !== undefined && Number(req.body.stock) < 0) {
    return sendError(res, 400, "Stock cannot be negative");
  }

  try {
    // Explicit whitelist — only pick fields the admin is allowed to change
    const {
      name,
      description,
      price,
      category,
      subcategory,
      image,
      images,
      sizes,
      colors,
      stock,
      featured,
    } = req.body;

    // Build the update object from only the fields that were actually provided
    // (undefined values are not included so partial updates work correctly)
    const updateData = {};
    if (name        !== undefined) updateData.name        = name;
    if (description !== undefined) updateData.description = description;
    if (price       !== undefined) updateData.price       = price;
    if (category    !== undefined) updateData.category    = category;
    if (subcategory !== undefined) updateData.subcategory = subcategory;
    if (image       !== undefined) updateData.image       = image;
    if (images      !== undefined) updateData.images      = images;
    if (sizes       !== undefined) updateData.sizes       = sizes;
    if (colors      !== undefined) updateData.colors      = colors;
    if (stock       !== undefined) updateData.stock       = stock;
    if (featured    !== undefined) updateData.featured    = featured;

    const product = await Product.findByIdAndUpdate(id, updateData, {
      new: true,           // return the updated document
      runValidators: true, // run schema validators on update
    });

    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, 400, messages.join(", "));
    }
    sendError(res, 500, "Failed to update product");
  }
};

/**
 * DELETE /api/products/:id
 * Deletes a product by ID.
 */
export const deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return sendError(res, 400, `Invalid product ID: ${id}`);
  }

  try {
    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return sendError(res, 404, "Product not found");
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: null,
    });
  } catch (error) {
    sendError(res, 500, "Failed to delete product");
  }
};
