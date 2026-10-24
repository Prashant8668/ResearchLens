const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const User = require('../src/models/User');
const Project = require('../src/models/Project');
const bcrypt = require('bcrypt');

let mongoServer;
let token1, token2;
let user1Id, user2Id;
let project1Id;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  
  const salt = await bcrypt.genSalt(10);
  const pass = await bcrypt.hash('password123', salt);
  
  const user1 = new User({ email: 'u1@t.com', password: pass, name: 'U1' });
  await user1.save();
  user1Id = user1._id;
  
  const user2 = new User({ email: 'u2@t.com', password: pass, name: 'U2' });
  await user2.save();
  user2Id = user2._id;
  
  const res1 = await request(app).post('/api/auth/login').send({ email: 'u1@t.com', password: 'password123' });
  token1 = res1.body.token;
  
  const res2 = await request(app).post('/api/auth/login').send({ email: 'u2@t.com', password: 'password123' });
  token2 = res2.body.token;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Project.deleteMany({});
});

describe('API Endpoints', () => {
  describe('Auth Routes', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test_new@test.com', password: 'password123', name: 'Test User' });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should login a user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'u1@t.com', password: 'password123' });
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });
    
    it('should fail login with bad password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'u1@t.com', password: 'wrong' });
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('JWT Middleware', () => {
    it('should reject missing token', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.statusCode).toEqual(401);
    });
    it('should reject invalid token', async () => {
      const res = await request(app).get('/api/projects').set('Authorization', 'Bearer invalidtoken');
      expect(res.statusCode).toEqual(401);
    });
  });

  describe('Project Routes & Authorization', () => {
    it('should create a project attached to authenticated user', async () => {
      const res = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer ' + token1)
        .send({ name: 'My Research', domain: 'AI' });
      expect(res.statusCode).toEqual(201);
      expect(res.body.name).toEqual('My Research');
      project1Id = res.body._id;
    });

    it('should fetch user specific projects', async () => {
      await request(app).post('/api/projects').set('Authorization', 'Bearer ' + token1).send({ name: 'P1' });
      const res = await request(app).get('/api/projects').set('Authorization', 'Bearer ' + token1);
      expect(res.statusCode).toEqual(200);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('should forbid user2 from accessing user1 project', async () => {
      const createRes = await request(app).post('/api/projects').set('Authorization', 'Bearer ' + token1).send({ name: 'P1' });
      const pId = createRes.body._id;
      
      const res = await request(app).get('/api/projects/' + pId).set('Authorization', 'Bearer ' + token2);
      expect(res.statusCode).toEqual(403);
    });
  });
});
