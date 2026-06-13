/**
 * Instagram Publisher Service
 * Handles publishing carousel posts to Instagram via Meta Graph API
 * Uses ngrok tunnel to expose local images as public URLs for the API
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// Global public base URL — set by server.js once ngrok tunnel is established
let PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || null;

function setPublicBaseUrl(url) {
  PUBLIC_BASE_URL = url;
  console.log(`🌐 Instagram Publisher: public URL set to ${url}`);
}

function getPublicBaseUrl() {
  return PUBLIC_BASE_URL;
}

class InstagramPublisher {
  constructor() {
    this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || 'EAAWySoFew1kBRrHU7JtiP1Dt5CIO4PnuwbDZCrnKhmyGeTnwH6ufGD63LqksxSZCuadh1FfPM1u79wd20Wd7f9ObIdv2T35oEsL64dY6uBog3C3o9YeLmI2FULs7UpTZArZCxr5rLT8OOMn8sf5ve14YD0EAR5dTdZB8le8ggYLT54qYqamSAF2Yi0dZCacAVP';
    this.accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || '17841427690261258';
    this.isConfigured = this.checkConfiguration();
  }

  checkConfiguration() {
    const hasToken = this.accessToken && this.accessToken !== 'your_instagram_access_token_here';
    const hasAccount = this.accountId && this.accountId !== 'your_instagram_business_account_id_here';

    if (!hasToken || !hasAccount) {
      console.log('⚠️  Instagram API not configured — running in PREVIEW MODE');
      return false;
    }

    console.log('✅ Instagram API configured — AUTO-PUBLISHING ENABLED');
    return true;
  }

  /**
   * Convert a local image file path to a public URL via ngrok tunnel
   */
  getPublicImageUrl(localImagePath) {
    const base = PUBLIC_BASE_URL ? PUBLIC_BASE_URL.replace(/\/+$/, '') : null;
    if (!base) throw new Error('No public URL configured. ngrok tunnel not started yet.');

    // Extract: backend/data/images/post_xxx/slide_1.png -> images/post_xxx/slide_1.png
    const imagesDir = path.join(__dirname, '../data/images');
    const relativePath = path.relative(imagesDir, localImagePath).replace(/\\/g, '/');
    return `${base}/images/${relativePath}`;
  }

  /**
   * Upload a single image to Instagram as a carousel item container
   * Instagram requires a publicly accessible image URL
   */
  async uploadImageAsCarouselItem(localImagePath) {
    if (!this.isConfigured) {
      return `preview_media_${Date.now()}`;
    }

    const imageUrl = this.getPublicImageUrl(localImagePath);
    
    // Bypass Render's Cloudflare anti-bot blocks by proxying the image through wsrv.nl
    // Facebook scraper gets blocked by free tier Render directly, but wsrv.nl does not.
    const proxiedImageUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}`;
    
    console.log(`    📸 Uploading: ${path.basename(localImagePath)} → ${proxiedImageUrl}`);

    try {
      const response = await axios.post(
        `${GRAPH_API_BASE}/${this.accountId}/media`,
        null,
        {
          params: {
            image_url: proxiedImageUrl,
            is_carousel_item: true,
            access_token: this.accessToken
          }
        }
      );
      return response.data.id;
    } catch (error) {
      const apiErr = error.response?.data?.error;
      const errMsg = apiErr ? `[${apiErr.code}] ${apiErr.type}: ${apiErr.message} (Subcode: ${apiErr.error_subcode})` : error.message;
      console.error(`    ❌ Image upload failed: ${errMsg}`);
      console.error(JSON.stringify(apiErr || {}, null, 2));
      throw new Error(errMsg);
    }
  }

  /**
   * Create a carousel media container from child media IDs
   */
  async createCarouselContainer(childMediaIds, caption) {
    if (!this.isConfigured) {
      return `preview_carousel_${Date.now()}`;
    }

    try {
      const response = await axios.post(
        `${GRAPH_API_BASE}/${this.accountId}/media`,
        null,
        {
          params: {
            media_type: 'CAROUSEL',
            children: childMediaIds.join(','),
            caption: caption,
            access_token: this.accessToken
          }
        }
      );
      return response.data.id;
    } catch (error) {
      const errMsg = error.response?.data?.error?.message || error.message;
      console.error(`    ❌ Carousel container failed: ${errMsg}`);
      throw new Error(errMsg);
    }
  }

  /**
   * Publish a created media container to Instagram
   */
  async publishContainer(containerId) {
    if (!this.isConfigured) {
      return { id: `preview_post_${Date.now()}`, preview_mode: true, published_at: new Date().toISOString() };
    }

    try {
      const response = await axios.post(
        `${GRAPH_API_BASE}/${this.accountId}/media_publish`,
        null,
        {
          params: {
            creation_id: containerId,
            access_token: this.accessToken
          }
        }
      );
      return { id: response.data.id, preview_mode: false, published_at: new Date().toISOString() };
    } catch (error) {
      const apiErr = error.response?.data?.error;
      const errMsg = apiErr ? `[${apiErr.code}] ${apiErr.type}: ${apiErr.message} (Subcode: ${apiErr.error_subcode})` : error.message;
      console.error(`    ❌ Publish failed: ${errMsg}`);
      console.error(JSON.stringify(apiErr || {}, null, 2));
      throw new Error(errMsg);
    }
  }

  /**
   * Full publishing flow for a single carousel post
   */
  async publishPost(post, carouselImages) {
    console.log(`\n🚀 Publishing post #${post.rank}: ${post.headline}`);

    const result = {
      post_id: post.post_id,
      rank: post.rank,
      headline: post.headline,
      status: 'pending',
      preview_mode: !this.isConfigured,
      instagram_post_id: null,
      published_at: null,
      error: null
    };

    try {
      if (!this.isConfigured) {
        await new Promise(r => setTimeout(r, 300));
        result.status = 'preview';
        result.instagram_post_id = `PREVIEW_${post.post_id}`;
        result.published_at = new Date().toISOString();
        console.log(`  ✅ [PREVIEW MODE] Post #${post.rank} would be published to Instagram`);
        console.log(`  📊 Slides: ${carouselImages.length}`);
        return result;
      }

      if (!PUBLIC_BASE_URL) {
        throw new Error('Public URL not available — ngrok tunnel not running');
      }

      // Step 1: Upload all slides as carousel item containers
      console.log(`  📤 Uploading ${carouselImages.length} slides to Instagram...`);
      const childMediaIds = [];
      for (const imagePath of carouselImages) {
        const mediaId = await this.uploadImageAsCarouselItem(imagePath);
        childMediaIds.push(mediaId);
        await new Promise(r => setTimeout(r, 1500)); // Respect rate limits
      }

      // Step 2: Create carousel container
      console.log(`  📦 Creating carousel container (${childMediaIds.length} slides)...`);
      const fullCaption = this.buildCaption(post);
      const containerId = await this.createCarouselContainer(childMediaIds, fullCaption);

      // Step 3: Wait then publish
      console.log(`  ⏳ Waiting 5s before publishing...`);
      await new Promise(r => setTimeout(r, 5000));

      console.log(`  📢 Publishing to Instagram...`);
      const publishResult = await this.publishContainer(containerId);

      result.status = 'published';
      result.instagram_post_id = publishResult.id;
      result.published_at = publishResult.published_at;

      console.log(`  ✅ Post #${post.rank} PUBLISHED! Instagram Post ID: ${publishResult.id}`);
      return result;

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
      console.error(`  ❌ Failed to publish post #${post.rank}: ${error.message}`);
      return result;
    }
  }

  buildCaption(post) {
    const caption = post.caption;
    if (!caption) return post.headline;
    if (caption.full_caption) return caption.full_caption;

    const parts = [
      caption.hook || '',
      '',
      caption.body || '',
      '',
      caption.engagement_prompt || '',
      '',
      caption.save_prompt || '',
      '',
      caption.call_to_action || '',
      '',
      (post.hashtags || []).join(' ')
    ];

    return parts.filter(p => p !== undefined).join('\n');
  }

  async publishAllPosts(posts, carouselRenderResults) {
    console.log('\n📱 Starting Instagram publishing for all posts...');
    console.log(`Mode: ${this.isConfigured ? '🟢 LIVE' : '🟡 PREVIEW'}`);
    if (this.isConfigured) {
      console.log(`🌐 Public URL: ${PUBLIC_BASE_URL || 'NOT SET'}`);
    }

    const imageMap = new Map(
      carouselRenderResults.map(r => [r.post_id, r.image_paths])
    );

    const publishResults = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const images = imageMap.get(post.post_id) || [];
      const result = await this.publishPost(post, images);
      publishResults.push(result);

      // Wait between posts to respect Instagram rate limits
      if (i < posts.length - 1) {
        const waitMs = this.isConfigured ? 30000 : 300;
        console.log(`  ⏳ Waiting ${waitMs / 1000}s before next post...`);
        await new Promise(r => setTimeout(r, waitMs));
      }
    }

    const successful = publishResults.filter(r => r.status === 'published').length;
    const previewed = publishResults.filter(r => r.status === 'preview').length;
    console.log(`\n✅ Publishing complete! ${successful} published, ${previewed} previewed, ${posts.length - successful - previewed} failed`);

    return publishResults;
  }

  async getPostAnalytics(instagramPostId) {
    if (!this.isConfigured || instagramPostId?.startsWith('PREVIEW_')) {
      return {
        id: instagramPostId,
        likes: Math.floor(Math.random() * 500) + 100,
        comments: Math.floor(Math.random() * 50) + 5,
        saves: Math.floor(Math.random() * 200) + 20,
        reach: Math.floor(Math.random() * 5000) + 500,
        impressions: Math.floor(Math.random() * 8000) + 1000,
        engagement_rate: (Math.random() * 5 + 2).toFixed(2),
        preview_mode: true,
        fetched_at: new Date().toISOString()
      };
    }

    try {
      const response = await axios.get(
        `${GRAPH_API_BASE}/${instagramPostId}/insights`,
        {
          params: {
            metric: 'likes,comments,saved,reach,impressions',
            access_token: this.accessToken
          }
        }
      );

      return {
        id: instagramPostId,
        ...response.data.data.reduce((acc, metric) => {
          acc[metric.name] = metric.values[0].value;
          return acc;
        }, {}),
        fetched_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Analytics fetch error:', error.message);
      return null;
    }
  }
}

const publisher = new InstagramPublisher();

module.exports = { publisher, InstagramPublisher, setPublicBaseUrl, getPublicBaseUrl };
