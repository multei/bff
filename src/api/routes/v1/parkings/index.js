const ApiProblem = require('express-api-problem');
const bodyParser = require('body-parser')
const createError = require('http-errors')
const Debug = require('debug')
const express = require('express')
const openALPR = require('openalpr/dist/express-middleware')
const router = express.Router()
const { create, list, read } = require('./db')

const googleCloudStorage = require('../../../middlewares/googleCloudStorage')
const multerUpload = require('../../../middlewares/multerUpload')

const debug = Debug('app:api:routes:v1:parkings')
debug('On /v1/parkings/index.js file')

router.use(bodyParser.urlencoded({extended: false, limit: '1mb'}))

/**
 * GET /v1/parkings
 *
 * Retrieve a list of illegal parkings
 */
router.get('/', bodyParser.json(), async function (req, res, next) {
  const handleSuccess = data => {
    debug('Success on listing parkings!')
    res.status(200).json({status: 'success', data: {parkings: data}});
  }
  const handleError = error => {
    debug('Error on listing parkings')
    next(new ApiProblem(500, 'Error when trying to return parkings list', 'It is an internal API issue', error))
  }

  debug('Listing parkings...')
  list().then(handleSuccess).catch(handleError)
})

/**
 * GET /v1/parkings/:car_plate
 *
 * Retrieve illegal parkings for a specific car plate
 */
router.get('/:car_plate', async function (req, res, next) {

  const car_plate = req.params['car_plate'];

  const handleSuccess = data => {

    debug('Success on listing data')

    if(data.length === 0) {
      return next(new ApiProblem(404, 'No parkings found with this plate', 'Please check if car_plate is correct', {car_plate}));
    }

    res.status(200).json({status: 'success', data: {parkings: data}});
  };

  const handleError = error => {
    debug('Error: %o', error)
    return next(new ApiProblem(500, 'Can not retrieve parkings', 'This is an internal API error', error))
  };

  debug('Reading from database, looking for car plate %o', car_plate)
  read({car_plate}).then(handleSuccess).catch(handleError)

})

/**
 * POST /v1/parkings
 */
router.post(
  '/',
  [
    multerUpload.fields([{name: 'car_front_photo', maxCount: 1}, {name: 'car_rear_photo', maxCount: 1}]),
    require('./validator'),
    openALPR('car_front_photo', process.env.OPENALPR_SECRET_KEY),
    openALPR('car_rear_photo', process.env.OPENALPR_SECRET_KEY),
    googleCloudStorage.uploadFile('car_front_photo'),
    googleCloudStorage.uploadFile('car_rear_photo')
  ],
  async function(req, res, next) {
    debug('Getting request body data')
    const { files, recognitionData } = req;
    const { car_front_photo, car_rear_photo } = recognitionData;
    const { plate, vehicle: { color, make, make_model } } = recognitionData['car_front_photo'].results[0];

    const data = {
      ...req.body,
      car_color: color[0].name,
      car_front_photo_uri: files['car_front_photo'].cloudStoragePublicUrl,
      car_front_photo_recognition_data: car_front_photo,
      car_make: make[0].name,
      car_make_model: make_model[0].name,
      car_plate: plate,
      car_rear_photo_uri: files['car_rear_photo'].cloudStoragePublicUrl,
      car_rear_photo_recognition_data: car_rear_photo,
    }
    debug('Data to be persisted: %o', data)

    const handleSuccess = response => {
      debug('Row saved at database with success: %o', data)
      res.status(200).json({
        status: 'success',
        data: {
          parkings: data
        }
      })
    }

    const handleError = error => {
      debug('Row not saved at database. Error: %o', error)
      next(new ApiProblem(500, 'Error when trying to save data', 'It is an internal server error', error))
    }

    debug('Saving on database...')

    create(data).then(handleSuccess).catch(handleError)
  }
)

/**
 * DELETE /v1/parkings/:car_plate
 *
 * Can not delete a illegal parking
 */
router.delete('/:param', bodyParser.json(), async (req, res, next) => {
  next(new ApiProblem(405, 'Deleting parking is not allowed'))
})

module.exports = router