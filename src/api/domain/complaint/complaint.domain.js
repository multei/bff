const { create, read, update, list } = require("../../services/db");
const { ApiProblem } = require("express-api-problem");
const {  ComplaintAlreadyCompletedException, CanNotRetrieveParkingDataException, CanNotUpdateDataException } = require("./complaint.exceptions");
const { Result } = require("express-validator");

function saveInitializedComplaint(data, res, handleSuccess, handleError) {
  create(data).then(handleSuccess).catch(handleError);
}

function finishComplaint(uuid, coordinates) {
  const whereObject = { uuid: uuid };

  return new Promise((resolve, reject) => {
    read(whereObject)
      .then((parking) => {
        if (isCompleted(parking[0])) {
          return reject(ComplaintAlreadyCompletedException());
        } else {
          updateComplaintLocation(whereObject, coordinates)
            .then(() => { return resolve(); })
            .catch((error) => { return reject(error); });
        }
      })
      .catch((error) => {
        return reject(CanNotRetrieveParkingDataException());
      });
  });
}

function updateComplaintLocation(whereObject, coordinates) {
  return new Promise((resolve, reject) => {
    const updateObject = { coordinates: coordinates };
    update(whereObject, updateObject, true)
      .then(() => {
        return resolve();
      })
      .catch((error) => {
        return reject(CanNotUpdateData());
      });
  });
}

function isCompleted(complaint) {
  return complaint.completed_at ? true : false
}

function retrieveAllComplaints(handleSuccess, handleError){
  list().then(handleSuccess).catch(handleError);
}

function retrieveComplaintByCarPlate(car_plate, handleSuccess, handleError)
{
  read({ car_plate }, { completed_at: null }).then(handleSuccess).catch(handleError);
}


module.exports = { saveInitializedComplaint, finishComplaint, isCompleted, retrieveAllComplaints, retrieveComplaintByCarPlate};
