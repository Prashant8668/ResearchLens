const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');

let mongoServer;
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Validation', () => {
  it('should return 400 for duplicate email', async () => {
    await request(app).post('/api/auth/register').send({ email: 'dup@test.com', password: 'password123', name: 'Dup' });
    const res = await request(app).post('/api/auth/register').send({ email: 'dup@test.com', password: 'password123', name: 'Dup2' });
    expect(res.statusCode).toEqual(400);
  });
  it('should return 400 for missing name', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'n@test.com', password: 'password123' });
    expect(res.statusCode).toEqual(400);
  });
  it('should return 400 for missing password', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'n@test.com', name: 'Name' });
    expect(res.statusCode).toEqual(400);
  });
  it('should return 400 for invalid email', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'invalid', password: 'password123', name: 'Name' });
    expect(res.statusCode).toEqual(400);
  });
  it('should return 400 for missing credentials on login', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toEqual(400);
  });
  it('should return 401 for non-existent email on login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nonexistent@test.com', password: 'password123' });
    expect(res.statusCode).toEqual(401);
  });
});
