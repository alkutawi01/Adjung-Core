class CanonicalSourceRecord {
  constructor({ id, title, content, url, publishedAt }) {
    this.id = id || '';
    this.title = title || '';
    this.content = content || '';
    this.url = url || '';
    this.publishedAt = publishedAt || '';
  }
}

export default CanonicalSourceRecord;
