const mongoose = require("mongoose");

const categories = require("../models/categorySchema");
const carts = require("../models/cartSchema");
const products = require("../models/productSchema");
const offers = require("../models/offerSchema");
const users = require("../models/userSchema");
const cron = require("node-cron");

const STATUS_SERVER_ERROR = parseInt(process.env.STATUS_SERVER_ERROR);

const loadOfferPage = async (req, res) => {
  try {
    const category = await categories.find();
    const currentOffers = await offers.find().populate("category");
    res.render("offers", {
      categories: category,
      msg: req.flash("offMsg"),
      offers: currentOffers,
      offErr: req.flash("offErr"),
    });
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const loadAddOfferPage = async (req, res) => {
  try {
    const category = await categories.find();
    res.render("addOffers", { categories: category });
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const addOffer = async (req, res) => {
  try {
    console.log(req.body);

    const { offerCategory, minPrice, maxPrice, offer } = req.body;
    const allOffers = await offers.find();
    let offerExists = false;
    for (let i = 0; i < allOffers.length; i++) {
      if (allOffers[i].category === offerCategory) {
        offerExists = true;
      }
    }
    if (offerExists) {
      req.flash("offErr", "Offer Exists");
      return res.redirect("/admin/offers");
    }

    const category = await categories.findOne({ name: offerCategory });

    await products.updateMany(
      {
        regularPrice: { $exists: false },
        category: category._id,
        amount: {
          $gte: parseInt(minPrice),
          $lte: parseInt(maxPrice),
        },
        $or: [{ hasOffer: false }, { hasOffer: { $exists: false } }],
      },
      [
        {
          $set: {
            regularPrice: "$amount",
            amount: {
              $round: [
                {
                  $subtract: [
                    "$amount",
                    {
                      $multiply: [
                        "$amount",
                        { $divide: [parseInt(offer), 100] },
                      ],
                    },
                  ],
                },
                2,
              ],
            },
            hasOffer: true,
          },
        },
      ]
    );

    const data = {
      category: category._id,
      minAmount: minPrice,
      maxAmount: maxPrice,
      offer: offer,
    };

    await offers.insertMany(data);
    req.flash("offMsg", "Offer added Successfully");
    res.redirect("/admin/offers");
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const loadOfferEditPage = async (req, res) => {
  try {
    const id = req.params.id;
    const offer = await offers.findById(id).populate("category");
    const allCategory = await categories.find();
    res.render("editOffers", { offer: offer, categories: allCategory });
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const editOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const { offerCategory, minPrice, maxPrice, offer } = req.body;

    const category = await categories.findOne({ name: offerCategory });

    await products.updateMany(
      {
        regularPrice: { $exists: true },
        category: category._id,
        regularPrice: {
          $gte: parseInt(minPrice),
          $lte: parseInt(maxPrice),
        },
        $or: [
          { singleProductOffer: false },
          { singleProductOffer: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            amount: {
              $round: [
                {
                  $subtract: [
                    "$regularPrice",
                    {
                      $multiply: [
                        "$regularPrice",
                        { $divide: [parseInt(offer), 100] },
                      ],
                    },
                  ],
                },
                2,
              ],
            },
          },
        },
      ]
    );

    const data = {
      category: category._id,
      minAmount: minPrice,
      maxAmount: maxPrice,
      offer: offer,
    };
    await offers.findByIdAndUpdate(id, { $set: data });
    req.flash("offMsg", "Offer edited successfully");
    res.redirect("/admin/offers");
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const deleteOffer = async (req, res) => {
  try {
    const id = req.params.id;
    const offerCategory=await offers.findOne({_id:id})
    const allCarts = await carts.find().populate("products.productId");

    if (allCarts.length > 0) {
      allCarts.forEach((userCart) => {
        if (userCart.products.length > 0) {
          userCart.products.forEach(async (product) => {
            if (product.productId.regularPrice) {
              await carts.updateOne(
                {
                  _id: userCart._id,
                },
                [
                  {
                    $set: {
                      totalAmount: {
                        $add: [
                          {
                            $subtract: [
                              "$totalAmount",
                              {
                                $multiply: [
                                  product.productId.amount,
                                  product.quantity,
                                ],
                              },
                            ],
                          },
                          {
                            $multiply: [
                              product.productId.regularPrice,
                              product.quantity,
                            ],
                          },
                        ],
                      },
                    },
                  },
                ]
              );
            }
          });
        }
      });
    }

    await carts.updateMany(
      {
        offerDiscount: { $exists: true },
      },
      {
        $set: {
          offerDiscount: 0,
        },
      }
    );

    await products.updateMany(
      {
        regularPrice: { $exists: true },
        $or: [
          { singleProductOffer: false },
          { singleProductOffer: { $exists: false } },
        ],
      },
      [
        {
          $set: {
            amount: "$regularPrice",
            hasOffer: false,
          },
        },
      ]
    );
    await products.updateMany(
      {
        regularPrice: { $exists: true },
        $or: [
          { singleProductOffer: false },
          { singleProductOffer: { $exists: false } },
        ],
      },
      {
        $unset: {
          regularPrice: "",
          offerDiscount: "",
        },
      }
    );

    try {
      await offers.deleteOne({
        _id: id,
      });
      res.json({ success: true });
    } catch (error) {
      res.json({ success: false });
    }
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const addSingleProductOffer = async (req, res) => {
  try {
    const productId = req.query.product;
    const offer = parseInt(req.query.offer);
    const hasOffer = await products.findOne({
      _id: productId,
      hasOffer: true,
    });
    if (hasOffer) {
      return res.json({ hasOffer: true });
    }
    const product = await products.findOne({ _id: productId });
    const reducedAmount = (product.amount * offer) / 100;
    await products.updateOne(
      {
        _id: productId,
      },
      [
        {
          $set: {
            regularPrice: product.amount,
            amount: {
              $round: [
                {
                  $subtract: ["$amount", reducedAmount],
                },
                2,
              ],
            },
            hasOffer: true,
            singleProductOffer: true,
          },
        },
      ]
    );
    res.json({ success: true });
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

const removeSingleProductOffer = async (req, res) => {
  try {
    const productId = req.query.product;
    await products.updateOne(
      {
        _id: productId,
      },
      [
        {
          $set: {
            amount: "$regularPrice",
            hasOffer: false,
            singleProductOffer: false,
          },
        },
      ]
    );
    await products.updateOne(
      {
        _id: productId,
      },
      {
        $unset: {
          regularPrice: "",
        },
      }
    );
    res.json({ success: true });
  } catch (error) {
    res.status(STATUS_SERVER_ERROR).render("admin404");
    
  }
};

module.exports = {
  loadOfferPage,
  loadAddOfferPage,
  addOffer,
  loadOfferEditPage,
  editOffer,
  deleteOffer,
  addSingleProductOffer,
  removeSingleProductOffer,
};
