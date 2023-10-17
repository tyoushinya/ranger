/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { useState, useEffect } from "react";
import ResourceComp from "../../Resources/ResourceComp";
import { useParams, useNavigate, Link } from "react-router-dom";
import { fetchApi } from "../../../utils/fetchAPI";
import { Loader } from "../../../components/CommonComponents";
import {
  Button,
  Col,
  Accordion,
  Card,
  Modal,
  Form as FormB
} from "react-bootstrap";
import { Form, Field } from "react-final-form";
import arrayMutators from "final-form-arrays";
import Select from "react-select";
import { groupBy, isArray, maxBy, find } from "lodash";
import { toast } from "react-toastify";

const AddSharedResourceComp = ({
  datashareId,
  onSharedResourceDataChange,
  onToggleAddResourceClose,
  isEdit,
  sharedResourceId
}) => {
  const [accessType, setAccessType] = useState();
  const [datashareInfo, setDatashareInfo] = useState({});
  const [showMaskInput, setShowMaskInput] = useState(false);
  const [showRowFilterInput, setShowRowFilterInput] = useState(false);
  const [serviceDef, setServiceDef] = useState({});
  const [serviceDetails, setService] = useState({});
  const [loader, setLoader] = useState(false);
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [openConfigAccordion, setOpenConfigAccordion] = useState(false);
  const [formData, setFormData] = useState();
  const [selectedResShareMask, setSelectedResShareMask] = useState({});
  const [loadSharedResource, setLoadSharedResource] = useState();

  useEffect(() => {
    fetchDatashareInfo(datashareId);
  }, []);

  const generateFormData = (obj, serviceDef) => {
    let data = {};
    data.shareName = obj.name;
    let serviceCompResourcesDetails = serviceDef?.resources;
    if (obj?.resource) {
      let lastResourceLevel = [];
      Object.entries(obj?.resource).map(([key, value]) => {
        let setResources = find(serviceCompResourcesDetails, ["name", key]);
        data[`resourceName-${setResources?.level}`] = setResources;
        data[`value-${setResources?.level}`] = value.values.map((m) => {
          return { label: m, value: m };
        });
        lastResourceLevel.push({
          level: setResources.level,
          name: setResources.name
        });
      });
      lastResourceLevel = maxBy(lastResourceLevel, "level");
      let setLastResources = find(serviceCompResourcesDetails, [
        "parent",
        lastResourceLevel.name
      ]);
      if (setLastResources && setLastResources?.isValidLeaf) {
        data[`resourceName-${setLastResources.level}`] = {
          label: "None",
          value: "none"
        };
      }
    }
    if (obj.accessTypes != undefined) {
      data.permission = obj.accessTypes.map((item) => ({
        label: item,
        value: item
      }));
    }
    if (obj.rowFilter != undefined) {
      data.rowFilter = obj.rowFilter["filterExpr"];
    }
    data.booleanExpression = obj.conditionExpr;
    return data;
  };

  const onAccessConfigAccordianChange = () => {
    setOpenConfigAccordion(!openConfigAccordion);
  };

  const fetchDatashareInfo = async (datashareId) => {
    try {
      const resp = await fetchApi({
        url: `gds/datashare/${datashareId}`
      });
      setDatashareInfo(resp.data);
      fetchServiceByName(resp.data.service);
    } catch (error) {
      console.error(
        `Error occurred while fetching datashare details ! ${error}`
      );
    }
  };

  const fetchServiceByName = async (serviceName) => {
    let serviceResp = [];
    try {
      serviceResp = await fetchApi({
        url: `plugins/services/name/${serviceName}`
      });
      setService(serviceResp.data);
      fetchServiceDef(serviceResp.data.type);
    } catch (error) {
      console.error(
        `Error occurred while fetching Service or CSRF headers! ${error}`
      );
    }
  };

  const fetchServiceDef = async (serviceDefName) => {
    let serviceDefsResp = [];
    try {
      serviceDefsResp = await fetchApi({
        url: `plugins/definitions/name/${serviceDefName}`
      });
    } catch (error) {
      console.error(
        `Error occurred while fetching Service Definition or CSRF headers! ${error}`
      );
    }
    let modifiedServiceDef = serviceDefsResp.data;
    for (const obj of modifiedServiceDef.resources) {
      obj.recursiveSupported = false;
      obj.excludesSupported = false;
    }
    if (Object.keys(modifiedServiceDef.rowFilterDef).length !== 0) {
      setShowMaskInput(true);
    }
    if (Object.keys(modifiedServiceDef.dataMaskDef).length !== 0) {
      setShowRowFilterInput(true);
    }

    setServiceDef(modifiedServiceDef);
    if (loadSharedResource != undefined) {
      setFormData(generateFormData(loadSharedResource, modifiedServiceDef));
    }
  };

  const fetchSharedResource = async (sharedResourceId) => {
    try {
      let params = {};
      const resp = await fetchApi({
        url: `gds/resource/${sharedResourceId}`
      });
      setLoadSharedResource(resp.data);
      setFormData(generateFormData(resp.data, serviceDef));
    } catch (error) {
      console.error(
        `Error occurred while fetching shared resource details ! ${error}`
      );
    }
  };

  const noneOptions = {
    label: "None",
    value: "none"
  };

  const getAccessTypeOptions = (formValues) => {
    let srcOp = [];
    const { resources = [] } = serviceDef;
    const grpResources = groupBy(resources, "level");
    let grpResourcesKeys = [];
    for (const resourceKey in grpResources) {
      grpResourcesKeys.push(+resourceKey);
    }
    grpResourcesKeys = grpResourcesKeys.sort();
    for (let i = grpResourcesKeys.length - 1; i >= 0; i--) {
      let selectedResource = `resourceName-${grpResourcesKeys[i]}`;
      if (
        formValues[selectedResource] &&
        formValues[selectedResource].value !== noneOptions.value
      ) {
        srcOp = serviceDef.accessTypes;
        if (formValues[selectedResource].accessTypeRestrictions?.length > 0) {
          let op = [];
          for (const name of formValues[selectedResource]
            .accessTypeRestrictions) {
            let typeOp = find(srcOp, { name });
            if (typeOp) {
              op.push(typeOp);
            }
          }
          srcOp = op;
        }
        break;
      }
    }

    return srcOp.map(({ label, name: value }) => ({
      label,
      value
    }));
  };

  const onAccessTypeChange = (event, input) => {
    setAccessType(event);
    input.onChange(event);
  };

  const handleSubmit = async (values, closeModal) => {
    console.log(values);
    console.log(values);
    let data = {};
    data.dataShareId = datashareId;
    let serviceCompRes = serviceDef.resources;
    const grpResources = groupBy(serviceCompRes || [], "level");
    let grpResourcesKeys = [];
    for (const resourceKey in grpResources) {
      grpResourcesKeys.push(+resourceKey);
    }
    grpResourcesKeys = grpResourcesKeys.sort();
    data.resource = {};
    for (const level of grpResourcesKeys) {
      if (
        values[`resourceName-${level}`] &&
        values[`resourceName-${level}`].value !== noneOptions.value
      ) {
        let defObj = serviceCompRes.find(function (m) {
          if (m.name == values[`resourceName-${level}`].name) {
            return m;
          }
        });
        data.resource[values[`resourceName-${level}`].name] = {
          values: isArray(values[`value-${level}`])
            ? values[`value-${level}`]?.map(({ value }) => value)
            : [values[`value-${level}`].value]
        };
      }
    }
    data.conditionExpr = values.booleanExpression;
    data.name = values.shareName;
    data.accessTypes = values.permission?.map((item) => item.value);
    data.rowFilter = values.rowFilter;
    data.resourceMask = values.resourceMask;

    try {
      setLoader(true);
      if (isEdit) {
        data.guid = loadSharedResource.guid;
        await fetchApi({
          url: `gds/resource/${loadSharedResource.id}`,
          method: "put",
          data: data
        });
        toast.success("Shared resource updated successfully!!");
      } else {
        await fetchApi({
          url: `gds/resource`,
          method: "post",
          data: data
        });
        toast.success("Shared resource created successfully!!");
      }
    } catch (error) {
      setLoader(false);
      serverError(error);
      if (loadSharedResource != undefined) {
        toast.success("Error occurred while updating Shared resource");
      } else {
        toast.success("Error occurred while creating Shared resource");
      }
      console.error(
        `Error occurred while creating/updating Shared resource  ${error}`
      );
    }
    onSharedResourceDataChange();
    setLoader(false);
    if (closeModal) {
      setShowAddResourceModal(false);
    }
    console.log(data);
  };

  const toggleAddResourceClose = () => {
    setShowAddResourceModal(false);
  };

  const onResShareMaskChange = (event, input) => {
    setSelectedResShareMask(event);
    input.onChange(event);
  };

  const addResource = () => {
    //setLoadSharedResource();
    setShowAddResourceModal(true);
  };

  const toggleAddResourceModalClose = () => {
    setShowAddResourceModal(false);
  };

  return (
    <>
      {/* <div className="gds-form-header-wrapper gap-half">
        <Button
          variant="light"
          className="border-0 bg-transparent"
          onClick={back}
          size="sm"
          data-id="back"
          data-cy="back"
        >
          <i className="fa fa-angle-left fa-lg font-weight-bold" />
        </Button>
        <h3 className="gds-header bold">Add Resource</h3>
      </div> */}
      {loader ? (
        <Loader />
      ) : (
        <>
          <div className="gds-header-btn-grp">
            {!isEdit ? (
              <Button
                variant="primary"
                onClick={addResource}
                size="sm"
                data-id="save"
                data-cy="save"
              >
                Add Resources
              </Button>
            ) : (
              <Button
                variant="outline-dark"
                size="sm"
                title="Edit"
                onClick={(e) => {
                  // e.stopPropagation();
                  // setLoadSharedResource(obj);
                  fetchSharedResource(sharedResourceId);
                  setShowAddResourceModal(true);
                }}
                data-name="editSharedResource"
                data-id="editSharedResource"
              >
                <i className="fa-fw fa fa-edit"></i>
              </Button>
            )}
          </div>
          <Modal
            show={showAddResourceModal}
            onHide={toggleAddResourceModalClose}
            //className="mb-7"
            size="xl"
          >
            <Modal.Header closeButton>
              <h5 className="mb-0">Add Resources</h5>
            </Modal.Header>
            {/* <div className="gds-form-wrap"> */}
            {/* <div className="gds-form-content"> */}
            <div>
              <div className="mb-2 gds-chips flex-wrap">
                <span
                  title={datashareInfo.name}
                  className="badge badge-light text-truncate"
                  style={{ maxWidth: "250px", display: "inline-block" }}
                >
                  Datashare: {datashareInfo.name}
                </span>
                <span
                  title={datashareInfo.service}
                  className="badge badge-light text-truncate"
                  style={{ maxWidth: "250px", display: "inline-block" }}
                >
                  Service: {datashareInfo.service}
                </span>
                {datashareInfo.zone != undefined ? (
                  <span
                    title={datashareInfo.zone}
                    className="badge badge-light text-truncate"
                    style={{ maxWidth: "250px", display: "inline-block" }}
                  >
                    Security Zone: {datashareInfo.zone}
                  </span>
                ) : (
                  <div></div>
                )}
              </div>
              <Form
                onSubmit={handleSubmit}
                initialValues={formData}
                mutators={{
                  ...arrayMutators
                }}
                render={({
                  handleSubmit,
                  values,
                  invalid,
                  errors,
                  required
                }) => (
                  <div>
                    <form
                      className="mb-5"
                      onSubmit={(event) => {
                        if (invalid) {
                          forIn(errors, function (value, key) {
                            if (
                              has(errors, "policyName") ||
                              resourceErrorCheck(errors, values)
                            ) {
                              let selector =
                                document.getElementById("isError") ||
                                document.getElementById(key) ||
                                document.querySelector(`input[name=${key}]`) ||
                                document.querySelector(`input[id=${key}]`) ||
                                document.querySelector(
                                  `span[className="invalid-field"]`
                                );
                            } else {
                              getValidatePolicyItems(errors?.[key]);
                            }
                          });
                        }
                      }}
                    >
                      <Modal.Body>
                        <div className="mb-4 mt-4">
                          <h6>Resource Details</h6>
                          <hr className="mt-1 mb-1 gds-hr" />
                        </div>
                        <div className="mb-3 form-group row">
                          <Col sm={3}>
                            <label className="form-label pull-right fnt-14">
                              Shared Resource Name
                            </label>
                            <span className="compulsory-resource top-0">*</span>
                          </Col>
                          <Col sm={9}>
                            <Field
                              name="shareName"
                              render={({ input, meta }) => (
                                <div className="flex-1">
                                  <input
                                    {...input}
                                    type="text"
                                    name="shareName"
                                    className="form-control"
                                    data-cy="shareName"
                                  />
                                </div>
                              )}
                            />
                          </Col>
                        </div>
                        <div className="gds-resource-hierarchy">
                          <ResourceComp
                            serviceDetails={serviceDetails}
                            serviceCompDetails={serviceDef}
                            formValues={values}
                            policyType={0}
                            policyItem={false}
                            policyId={0}
                            isGds={true}
                          />
                        </div>

                        <Accordion className="mb-3" defaultActiveKey="0">
                          <Card className="border-0 gds-resource-options">
                            <div>
                              <Accordion.Toggle
                                as={Card.Header}
                                eventKey="1"
                                onClick={onAccessConfigAccordianChange}
                                className="d-flex align-items-center gds-res-acc-header gap-half"
                                data-id="panel"
                                data-cy="panel"
                              >
                                {openConfigAccordion ? (
                                  <i className="fa fa-angle-up pull-up fa-lg font-weight-bold"></i>
                                ) : (
                                  <i className="fa fa-angle-down pull-down fa-lg font-weight-bold"></i>
                                )}
                                <Link to="">
                                  Add permission and conditions (Optional)
                                </Link>
                              </Accordion.Toggle>
                            </div>
                            <Accordion.Collapse eventKey="1">
                              <Card.Body className="gds-res-card-body">
                                <div className="mb-3 form-group row">
                                  <Col sm={3}>
                                    <label className="form-label pull-right fnt-14">
                                      Add Permissions
                                    </label>
                                  </Col>
                                  <Field
                                    name="permission"
                                    render={({ input, meta }) => (
                                      <Col sm={9}>
                                        <Select
                                          {...input}
                                          options={getAccessTypeOptions(values)}
                                          onChange={(e) =>
                                            onAccessTypeChange(e, input)
                                          }
                                          //menuPortalTarget={document.body}
                                          //value={accessType}
                                          menuPlacement="auto"
                                          isClearable
                                          isMulti
                                        />
                                      </Col>
                                    )}
                                  />
                                </div>
                                {false && showRowFilterInput ? (
                                  <div className="mb-3 form-group row">
                                    <Col sm={3}>
                                      <label className="form-label pull-right fnt-14">
                                        Row Filter
                                      </label>
                                    </Col>

                                    <Field
                                      name={`rowFilter`}
                                      render={({ input, meta }) => (
                                        <Col sm={9}>
                                          <input
                                            {...input}
                                            type="text"
                                            name="rowFilter"
                                            className="form-control gds-placeholder"
                                            data-cy="rowFilter"
                                          />
                                        </Col>
                                      )}
                                    />
                                  </div>
                                ) : (
                                  <div></div>
                                )}

                                {false && showMaskInput ? (
                                  <div className="mb-3 form-group row">
                                    <Col sm={3}>
                                      <label className="form-label pull-right fnt-14">
                                        Mask
                                      </label>
                                    </Col>

                                    <Field
                                      name={`maskType`}
                                      render={({ input, meta }) => (
                                        <Col sm={9}>
                                          <Field
                                            name="masking"
                                            render={({ input, meta }) => (
                                              <div className="d-flex ">
                                                <div className="w-50">
                                                  <Select
                                                    {...input}
                                                    options={
                                                      serviceDef.dataMaskDef
                                                        .maskTypes
                                                    }
                                                    onChange={(e) =>
                                                      onResShareMaskChange(
                                                        e,
                                                        input
                                                      )
                                                    }
                                                    menuPlacement="auto"
                                                    isClearable
                                                  />
                                                </div>
                                                {selectedResShareMask?.label ==
                                                  "Custom" && (
                                                  <div className="pl-2 w-50">
                                                    <Field
                                                      className="form-control"
                                                      name={`resShareDataMaskInfo.valueExpr`}
                                                      validate={required}
                                                      render={({
                                                        input,
                                                        meta
                                                      }) => (
                                                        <>
                                                          <FormB.Control
                                                            type="text"
                                                            className="gds-input"
                                                            {...input}
                                                            placeholder="Enter masked value or expression..."
                                                          />
                                                          {meta.error && (
                                                            <span className="invalid-field">
                                                              {meta.error}
                                                            </span>
                                                          )}
                                                        </>
                                                      )}
                                                    />
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          />
                                        </Col>
                                      )}
                                    />
                                  </div>
                                ) : (
                                  <div></div>
                                )}

                                <div className="mb-0 form-group row">
                                  <Col sm={3}>
                                    <label className="form-label pull-right fnt-14">
                                      Add Condition
                                    </label>
                                  </Col>
                                  <Field
                                    name={`booleanExpression`}
                                    render={({ input, meta }) => (
                                      <Col sm={9}>
                                        <textarea
                                          {...input}
                                          placeholder="Enter Boolean Expression"
                                          className="form-control gds-placeholder"
                                          id="booleanExpression"
                                          data-cy="booleanExpression"
                                          rows={4}
                                        />
                                      </Col>
                                    )}
                                  />
                                </div>
                              </Card.Body>
                            </Accordion.Collapse>
                          </Card>
                        </Accordion>
                      </Modal.Body>
                      <Modal.Footer>
                        <div className="d-flex gap-half justify-content-end w-100">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={toggleAddResourceClose}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(event) => {
                              handleSubmit(event, true);
                            }}
                          >
                            {isEdit ? "Update" : "Save & Close"}
                          </Button>
                          {!isEdit ? (
                            <Button
                              onClick={(event) => {
                                handleSubmit(event, false);
                              }}
                              variant="primary"
                              size="sm"
                              data-id="save"
                              data-cy="save"
                            >
                              Save & Add Another
                            </Button>
                          ) : (
                            <div></div>
                          )}
                        </div>
                      </Modal.Footer>
                    </form>
                  </div>
                )}
              />
            </div>
            {/* </div> */}
            {/* </div> */}
          </Modal>
        </>
      )}
    </>
  );
};

export default AddSharedResourceComp;