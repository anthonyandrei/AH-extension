//======================================================================================
// MODULE NAME   : RFC MVC STUDENT PORTAL
// PAGE NAME     : ENLISTMENT
// CREATION DATE : 09-08-2023
// CREATED BY    : SAI HARNE
// DEVELOPED BY  : VAISHNAVI KALBENDE
// MODIFIED BY   : SARANG MUTKURE
// Description   : The enlistment page is only for students to register for courses according to the configuration
//======================================================================================

$(document).ready(function () {
    Enlistment_V2.Init();
});
let weekTab = 1;
let SectionData;
let IsExamRegistration = 0;
let Is_AutoAdvising = 0;
let EnlistmentMethod = 0;
let PaymentTypeId = 0;
let isCoreDisabled = '';
let ClashStatus = 0;
var DemandCount = 0;
let demandpgId = 0;
let formattedStartDate = ``;
let MinorMajorDemandPg = 0;
let MinorMajorDemandCount = 0;
let totalMinorMajorAmount = 0;
let LateFeeDemandPg = 0;
var CurrentCommesmentDate;
var StudentRegistered = 0;
var DownPayCheck = 0;
var FinalConfimSubmit = 0;
var ShoWAlertOnBlockSection = 0;
var CourseFinalGridCheck = [];
let IsDisabledTab = 0;
let AlreadyLoadData = 0;
let IsDemandGenerated = 0;

$(".ms-8").css("padding-right", "145px");
var Enlistment_V2 = function () {
    /*
      NAME  : init
      DESC  : Initializes various UI elements and event handlers on the page. This function sets up loaders, hides specific sections, initializes dropdowns and events, and configures tab event handling.
      PARAMS: NA
      OUTPUT: NA
    */
    var init = async function () {
        $(".loader-2").css("display", "block");
        $("#configStep2Section").hide();
        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divPayStatus").removeClass("d-none");
        await GetAllDropDown();
        EnlistmentEvent();
        // $("#DivBindCourseList").click();

        //ScheduleEvent();
        PartialUserDeactivation("Enlistment", "#btnAdd,#btnEnlistment");
        var target = $('a[data-bs-toggle="tab"].nav-link.active').attr("href");
        $('a[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) {
            target = $(e.target).attr("href")
            $(".loader-area, .loader").css("display", "block");
            $(".loader-area, .loader").fadeOut('slow');
        });
        $("#tblMapping").hide();

        $(".loader-2").fadeOut('slow');
        //$("#viewDetailsModalView").appendTo("body");  	

    };
    /*
     NAME  : Step2ClickHandler
     DESC  : Handles the click event on the anchor element with href attribute "#STEP2". It shows loaders, hides certain sections, and checks conditions related to down payment before proceeding with enlistment.
     PARAMS: NA
     OUTPUT: NA
   */
    $('a[href="#STEP2"]').click(function () {
        $(".loader-area, .loader").css("display", "block");
        $(".loader-area, .loader").fadeOut('slow'); $("#divPayStatus").addClass("d-none");
        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
        if (isDownPayment == 1) {
            if (downPaymentEventId == 1) {
                if (demandAmount == 0 && downPaymentStatus == 5) {
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }
                else if (downPaymentStatus != 1) {
                    iziToast.warning({ message: `Please complete your down-payment inorder to proceed for Enlistment !` })
                    $('a[href="#STEP1"]').tab('show'); $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").show();
                    return false;
                }
            }
        }
        //GetSectionList($("#hdfAcademicSessionId").val());
        GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
    });
    /*
  NAME  : Step1ClickHandler
  DESC  : Handles the click event on the anchor element with href attribute "#STEP1". It checks down payment conditions to show or hide down payment sections, and sets the enrollment option based on a predefined method.
  PARAMS: N/A
  OUTPUT: N/A
*/
    $('a[href="#STEP1"]').click(function () {
        $("#divPayStatus").removeClass("d-none");
        if (isDownPayment == 1) {
            if (downPaymentEventId == 1) {
                if (demandAmount == 0 && downPaymentStatus == 5) {
                    $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").hide(); $("#spnPayementExamptSataus").removeClass("d-none");
                }
                else {
                    $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").show();
                }
            } else {
                $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
            }
        }
        else {
            $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
        }
        $('input[name="EnrollmentOption"][value="' + enrollmentMethod + '"]').prop('checked', true);
        $('#ddlTimeSlot').val(slotId).select2();
    });
    /*
  NAME  : Step3ClickHandler
  DESC  : Handles the click event on the anchor element with href attribute "#STEP3". It hides the down payment configuration and application sections.
  PARAMS: NA
  OUTPUT: NA
*/
    $('a[href="#STEP3"]').click(function () {
        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divPayStatus").addClass("d-none");
    });
    let StudentDetails;
    var EnlistmentEvent = function () {
        function generateReport(programId, semesterId, IsReportName) {
            var $button = $('#btnTimeTable');
            var $tabContainer = $('#statusEnlistment');

            try {
                // Disable button and show loading spinner
                $button.prop('disabled', true).html(
                    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> ' +
                    '<span>Generating...</span>'
                );

                // Disable tab switching (if applicable)
                $tabContainer.addClass('loading');

                $.ajax({
                    url: "/Enlistment/GetReportConfigurationData/",
                    type: "POST",
                    data: {
                        programId: programId,
                        semesterId: semesterId,
                        academicSessionId: $("#hdfAcademicSessionId").val()
                    },
                    success: function (responseData) {
                        var formdata = {};
                        var reportName = "";
                        var startDate = moment().startOf('week').format('YYYY-MM-DD');
                        var endDate = moment().endOf('week').format('YYYY-MM-DD');
                        var academicSessionId = $("#hdfAcademicSessionId").val();
                        reportName = IsReportName ? IsReportName : "DEFAULT ENLISTMENT SLIP";
                        // Determine report name
                        if (responseData && responseData.length > 0) {
                            var reportConfig = responseData[0];
                            if (reportName && reportName.toUpperCase() === "LPU REPORT") {
                                if (reportConfig.IS_OFFICIAL_ASSESMENT === 1) {
                                    reportName = "OFFICIAL ENROLLMENT ASSESSMENT FORM";
                                } else if (reportConfig.IS_OFFICIAL_ASSESMENT === 0) {
                                    reportName = "UNOFFICIAL ENROLLMENT ASSESSMENT FORM";
                                }
                            }
                        }
                        // Prepare form data
                        formdata = {
                            startdate: startDate,
                            enddate: endDate,
                            academicSessionId: academicSessionId,
                            programId: programId,
                            semesterId: semesterId,
                            Name: reportName
                        };

                        // Encode and send to backend
                        var encodedData = encodeHtmlEntities(JSON.stringify(formdata));
                        //  Fetch Base64 PDF from backend
                        fetch("/Enlistment/ReportViewer?data=" + encodeURIComponent(encodedData))
                            .then(response => response.json())
                            .then((result) => {
                                if (result?.ApiStatus && result?.FileContent) {
                                    downloadBase64Pdf(result.FileContent, `${reportName}.pdf`);
                                } else {
                                    alert("Failed to generate report.");
                                }
                            })
                            //.then(result => {
                            //    if (result && result.ApiStatus) {
                            //        //  Download using helper function
                            //        downloadBase64Pdf(result.FileContent, (reportName + ".pdf"));
                            //    } else {
                            //        alert("Failed to generate report.");
                            //    }
                            //})
                            .catch(err => {
                                console.error("Error fetching report:", err);
                                alert("Error generating report.");
                            })
                            .finally(() => {
                                // Reset UI
                                $button.prop('disabled', false).text('Enlistment Slip');
                                $tabContainer.removeClass('loading');
                            });
                    },
                    error: function () {
                        $button.prop('disabled', false).text('Enlistment Slip');
                        alert('There was an error while fetching the data.');
                        $tabContainer.removeClass('loading');
                    }
                });
            } catch (e) {
                console.error("Error in generateReport:", e);
                $button.prop('disabled', false).text('Enlistment Slip');
                $tabContainer.removeClass('loading');
            }
        }

        // Add this helper below your function
        function downloadBase64Pdf(base64, filename) {
            try {
                const byteCharacters = atob(base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });
                const blobUrl = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = filename || 'report.pdf';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                URL.revokeObjectURL(blobUrl);
            } catch (e) {
                console.error("Error downloading PDF:", e);
            }
        }

        // Attach the independent function to the click event
        $('#statusEnlistment').on('click', '#btnTimeTable', function () {
            var programId = ProgramId;  // Define ProgramId dynamically as required
            var semesterId = SemesterId;  // Define SemesterId dynamically as required

            if (IsReportType == 1) {
                $('#EnlistmentSlipModal').modal('show');
                GenerateHTMLReport();
            } else {
                generateReport(programId, semesterId, IsReportName);
            }
        });

        /* 
                  NAME  :statusEnlistment
                  DESC  :Show student enlistment subjects
                  PARAMS:startdate,enddate,STUDENT_ID
                  OUTPUT:STUDENT_ID,STUDENT_INPUT_ID,STUDENT_FULL_NAME,ACADEMIC_SESSION_ID,ACADEMIC_SESSION_NAME,COLLEGE_PROGRAM_ID,PROGRAM_TITLE,ENROLLMENT_SEMESTER_ID,SEMESTER_NAME,COURSE_CREATION_ID,COURSE_NAME,COURSE_CODE,COURSE_TYPE_ID,COURSE_TYPE_NAME,ROOM_NAME,TIME_TABLE_DATE,TIME,ACD_MST_DAY_ID,DAY_NAME,SECTION_CREATION_ID,SECTION_NAME,CREDITS
              */
        /* $('#statusEnlistment').on('click', '#btnTimeTable', function ()*/
        function GenerateHTMLReport() {
            $('#tblPaymentDetailsSlip tbody').empty(); $('#tblInstallment1 tbody').empty();
            $.ajax({
                url: "/Enlistment/GetEnlistmentReportData/",
                type: 'post',
                //async: false,
                data: { startdate: new moment(moment().startOf('week').toDate()).format('YYYY-MM-DD'), enddate: new moment(moment().endOf('week').toDate()).format('YYYY-MM-DD'), academicSessionId: $("#hdfAcademicSessionId").val(), logo: '' },
                success: function (data) {
                    var html = ``; var CourseList = new Array();
                    $('#EnlistmentReport').empty();
                    $('#imgBanner').prop("src", 'data:image/png;base64,' + data[0].LOGO);
                    $('#academicSession').text(data.length > 0 ? data[0].ACADEMIC_SESSION_NAME : '-');
                    $('#enlistmentDate').text(data[0].ENLISTED_DATE);
                    if (data.length > 0) {
                        $.each(data, function (index, row) {
                            html += ` <tr>
                            <td>${index + 1}</td>
                            <td class="text-start">${row.COURSE_CODE} - ${row.COURSE_NAME}</td>
                            <td>${row.COURSE_TYPE_NAME}</td>
                            <td>${row.SECTION_NAME}</td>
                            <td>${row.CREDITS}</td>
                            <td class="text-start">${row.TIME_TABLE_DATE}</td>
                        </tr>`;
                            var list = {
                                COURSE_CREATION_ID: row.COURSE_CREATION_ID
                            };
                            CourseList.push(list);
                        })
                        $('#EnlistmentReport').append(html);
                        var inputdata = { programid: collegeProgramid, semesterid: enrollmentSemesterId, academicSessionId: $("#hdfAcademicSessionId").val() }
                        $.ajax({
                            url: "/Enlistment/GetFeesDetailsForEnlistmentSlip/",
                            type: 'post',
                            data: inputdata,
                            dataType: "json",
                            //async: false,
                            success: function (Previewdata) {
                                var htmlString = ``;
                                $.each(Previewdata["DEMAND_DETAILS"], function (index, row) {
                                    htmlString += `<tr>
                                    <td>${row.FEESHEAD_NAME}</td>
                                    <td>${row.AMOUNT}</td>
                                </tr>`;
                                });

                                htmlString += `<tr>
                                <td><b>Total Fees</b></td>
                                <td><b>${Previewdata.TOTAL_FEES}</b></td>
                            </tr>
                            <tr>
                                <td>Down Payment</td>
                                <td>-${Previewdata.DOWN_PAYMENT}</td>
                            </tr>
                             <tr>
                                <td>Scholarship</td>
                                <td>-${Previewdata.TOTAL_DISCOUNT}</td>
                            </tr>
                            <tr>
                                <td>Excess Scholarship</td>
                                <td>${Previewdata.EXCESS_SCHOLARSHIP_AMOUNT}</td>
                            </tr>`;
                                $('#tblPaymentDetailsSlip tbody').append(htmlString);
                                $.each(Previewdata["INSTALLMENT_DETAILS"], function (index, row) {
                                    var html = `<tr>
                                       <td>Installment - ${row.INSTALLMENT_NO}</td>
                                       <td>${row.AMOUNT}</td>
                                       <td>${row.INSTALLMENT_DATE == null ? "" : row.INSTALLMENT_DATE}</td>
                                       <td>${row.PAID_AMOUNT}</td>
                                       <td>${row.SCHOLARSHIP_AMOUNT}</td>
                                       <td>${row.BALANCE_AMOUNT}</td>`
                                    if (row.INSTALLMENT_STATUS == 0) {
                                        html += `<td><span class="badge badge-warning badge-outline">Unpaid</span></td>
                                   </tr>`;
                                    }
                                    else if (row.INSTALLMENT_STATUS == 1) {
                                        html += `<td><span class="badge badge-success badge-outline">Paid</span></td>
                                   </tr>`;
                                    }
                                    $('#tblInstallment1 tbody').append(html);
                                })
                            }
                        });
                        $("#divReportText").html(data[0].USER_INSTRUCTION);
                        $("#spnPrintDate").html('Print Date : ' + new Date());
                    } else {
                        $('#tblEnlistmentSilp tbody').html('<tr class="no-records"><td colspan="6" class="text-center">Data not found</td></tr>');
                    }

                }
            });
        }

        /*
  NAME  : CreateDownPaymentDemand
  DESC  : Creates a down payment demand for a student by preparing necessary data and making an AJAX request to the server to initiate the payment request. Logs the payment submission attempt and handles the server response.
  PARAMS: None
  OUTPUT: r-out return 1 for success
*/
        async function CreateDownPaymentDemand() {
            var DemandArray = new Array();
            var list = {
                FEESHEAD_ID: feeheadId,
                AMOUNT: demandAmount
            }
            DemandArray.push(list);

            var formData = {
                ACADEMIC_YEAR_ID: academicYearId,
                STUDENT_ID: studentId,
                COLLEGE_PROGRAM_ID: collegeProgramid,
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                RECEIPT_TYPE_ID: receiptTypeId,
                MST_CURRENCY_ID: mstCurrencyId,
                DEMAND_TYPE: demandpgId == 0 ? 'N' : 'O',
                DEMANDPG_ID: demandpgId,
                PAGE_NAME: 'Enlistment/index',
                DEMAND_DETAILS_TBL: DemandArray
            }

            let data = await $.ajax({
                url: "/OnlinePaymentRequest/CreateDemandRequest/",
                dataType: "json",
                method: 'post',
                data: JSON.stringify(formData),
                contentType: "application/json;charset=utf-8"
            });
            //async: false,
            //success: function (data) {
            if (data.IS_SUCCESS == 1) {

                var formLogData = {
                    ACADEMIC_YEAR_ID: academicYearId,
                    STUDENT_ID: studentId,
                    COLLEGE_PROGRAM_ID: collegeProgramid,
                    ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                    RECEIPT_TYPE_ID: receiptTypeId,
                    MST_CURRENCY_ID: mstCurrencyId,
                    DEMAND_TYPE: 'Down Payment',
                    DEMANDPG_ID: demandpgId == 0 ? data.DEMANDPG_ID : demandpgId,
                    PAGE_NAME: 'Enlistment/index',
                    FEESHEAD_ID: feeheadId,
                    AMOUNT: demandAmount,
                    CAMPUSNO: campusNo,
                    PAYMENT_MODE_NAME: 'AFTER ENLISTMENT'
                }
                await DownPaymentSubmitLog(formLogData);

                return true;
            }
            else {
                const message = data.ERROR_MESSAGE || 'Unable to create down-payment demand !';
                iziToast.warning({ message });
                return false;
            }

            //    },
            //    error: function (err) {
            //        console.log(err);
            //    }
            //});
        }
        /*
NAME  : CreateDemandForLateFee
DESC  : Creates a demand for late fee a student by preparing necessary data and making an AJAX request to the server to initiate the payment request. Logs the payment submission attempt and handles the server response.
PARAMS: None
OUTPUT: r-out return 1 for success
*/
        async function CreateDemandForLateFee() {
            var DemandArray = new Array();
            var list = {
                FEESHEAD_ID: LateFeeFeeheadId,
                AMOUNT: Late_Fee_Amount
            }
            DemandArray.push(list);

            var formData = {
                ACADEMIC_YEAR_ID: academicYearId,
                STUDENT_ID: studentId,
                COLLEGE_PROGRAM_ID: collegeProgramid,
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                RECEIPT_TYPE_ID: LateFeeReceiptId,
                MST_CURRENCY_ID: mstCurrencyId,
                DEMAND_TYPE: LateFeeDemandPg == 0 ? 'N' : 'O',
                DEMANDPG_ID: LateFeeDemandPg,
                PAGE_NAME: 'Enlistment/index',
                DEMAND_DETAILS_TBL: DemandArray,
                REMARK: 'Late Fee'
            }

            let data = await $.ajax({
                url: "/OnlinePaymentRequest/CreateDemandRequest/",
                dataType: "json",
                method: 'post',
                data: JSON.stringify(formData),
                contentType: "application/json;charset=utf-8"
            });
            //async: false,
            //success: function (data) {
            if (data.IS_SUCCESS == 1) {

                var formLogData = {
                    ACADEMIC_YEAR_ID: academicYearId,
                    STUDENT_ID: studentId,
                    COLLEGE_PROGRAM_ID: collegeProgramid,
                    ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                    RECEIPT_TYPE_ID: LateFeeReceiptId,
                    MST_CURRENCY_ID: mstCurrencyId,
                    DEMAND_TYPE: 'Late Fee',
                    DEMANDPG_ID: LateFeeDemandPg == 0 ? data.DEMANDPG_ID : LateFeeDemandPg,
                    PAGE_NAME: 'Enlistment/index',
                    FEESHEAD_ID: LateFeeFeeheadId,
                    AMOUNT: Late_Fee_Amount,
                    CAMPUSNO: campusNo,
                    PAYMENT_MODE_NAME: 'ENLISTMENT LATE FEE'
                }
                await DownPaymentSubmitLog(formLogData);

                return true;
            }
            else {
                const message = data.ERROR_MESSAGE || 'Unable to generate a late fee demand !';
                iziToast.warning({ message });
                return false;
            }

            //},
            //error: function (err) {
            //    console.log(err);
            //}

        }

        /*
NAME  :btnConfirmEnlistment
DESC  :Open Model popup
PARAMS:NA
OUTPUT:NA
*/
        $(document).on('click', '#btnConfirmEnlistment', function () {
            if (FinalConfirmInstruction == 1) {
                $('#viewTermsAndConditionsModal').modal('show');
            } else {
                $("#btnAgree").click();
            }
        });
        /*
NAME  :btnCancel
DESC  :Close Model popup
PARAMS:NA
OUTPUT:NA
*/
        $(document).on('click', '#btnCancel', function () {
            $('#viewTermsAndConditionsModal').modal('hide');
        });
        /*
NAME  :btnAgree
DESC  :save list of selected subjects
PARAMS:ACADEMIC_SESSION_ID,CAMPUSNO,CURRICULUM_CREATION_ID,ENROLLMENT_SEMESTER_ID,INSTITUTE_CREATION_ID,ACTIVE,CourseSelectionList list,IS_EXAM_REGISTRATION,IS_AUTO_ADVISING,ENLISTMENT_METHOD,SECTION_CREATION_ID,COMMAND_TYPE,ENLISTMENT_RULE_ID,ENLISTMENT_RULE_ALLOCATION_ID,INSTITUTE_CREATION_ID,CREATEDBY,IPADDRESS,INSTITUTE_CREATION_ID
OUTPUT:r_out return value 1 or more
*/
        $(document).on('click', '#btnAgree', function () {
            try {
                var EnlistmentArray = new Array();
                var EnlistmentFeeArray = new Array();
                var credits = 0;
                var validate = false; var ValidateMinorMajor = false; var MandatoryValidation = false;
                var BucketSegmentArray = new Array();
                var ElectiveCriteria = new Array();
                var ElectiveValidation = false; var Is_minor_major_select = 0; var Is_remaining_select = 0;
                var EnlistmentClashArray = new Array();
                var EnlistmentAdditionalDetails = new Array();
                var CheckEquivalenceData = new Array();
                var CheckEquivalenceMandatory = new Array();
                var CheckEquiValidateArray = new Array();
                var ErrorMessage = '';

                $("#tblRegularCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkCourseOfferChlId]')).data("mandatory");
                    const IsLockCore = $(this).find($('[id ^= chkCourseOfferChlId]')).data("lockcore");
                    const isoneway = $(this).find($('[id ^= chkCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("equivalence").split(",");

                    const check = $(this).find($('[id ^= chkCourseOfferChlId]')).data("check");
                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Core Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                        return false;
                    }
                    if (IsLockCore == 1 && oneway == 0 && requisiteStatus == 0 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-LockCourse") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                        return false;
                    }
                    if (oneway == 1 && Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1 && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblElectiveCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES, ELECTIVE_GROUP_ID, ELECTIVE_GROUP_NAME, MIN_NO_OF_COURSES] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("elective").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkECourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkECourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkECourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkECourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Elective Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Elective Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Elective Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }

                            if (NO_OF_COURSES > 0) {
                                var ElectiveList = {
                                    IS_FLEXIBLE: IS_FLEXIBLE,
                                    NO_OF_COURSES: NO_OF_COURSES,
                                    LOOP_COUNT: NO_OF_COURSES,
                                    ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                    MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                    ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                    IS_CHECKBOX_CHECK: 1
                                }
                                ElectiveCriteria.push(ElectiveList);
                                var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                                if (distinctGElective.length > NO_OF_COURSES) {
                                    ElectiveValidation = true;
                                    iziToast.warning({
                                        message: 'Maximum Selected Elective Courses Should Be ' + NO_OF_COURSES + ' For ' + ELECTIVE_GROUP_NAME
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 1,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    } else {
                        if (MIN_NO_OF_COURSES > 0) {

                            var ElectiveList = {
                                IS_FLEXIBLE: IS_FLEXIBLE,
                                NO_OF_COURSES: NO_OF_COURSES,
                                LOOP_COUNT: NO_OF_COURSES,
                                ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                IS_CHECKBOX_CHECK: 0
                            }
                            ElectiveCriteria.push(ElectiveList);
                        }
                    }
                });
                $(ElectiveCriteria).each(function (index, row) {
                    var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                    if (distinctGElective.length == 0) {
                        distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 0);
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Elective Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                    else if (distinctGElective.length < distinctGElective[0].MIN_NO_OF_COURSES) {
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Elective Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                });
                if (ElectiveValidation == true) {
                    return false;
                }
                $("#tblGlobalCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES, ELECTIVE_GROUP_ID, ELECTIVE_GROUP_NAME, MIN_NO_OF_COURSES] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("gelective").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Global Elective Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Global Elective Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Global Elective Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }

                            if (NO_OF_COURSES > 0) {
                                var ElectiveList = {
                                    IS_FLEXIBLE: IS_FLEXIBLE,
                                    NO_OF_COURSES: NO_OF_COURSES,
                                    LOOP_COUNT: NO_OF_COURSES,
                                    ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                    MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                    ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                    IS_CHECKBOX_CHECK: 1
                                }
                                ElectiveCriteria.push(ElectiveList);
                                var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                                if (distinctGElective.length > NO_OF_COURSES) {
                                    ElectiveValidation = true;
                                    iziToast.warning({
                                        message: 'Maximum Selected Global Elective Courses Should Be ' + NO_OF_COURSES + ' For ' + ELECTIVE_GROUP_NAME
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 1,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    } else {
                        if (MIN_NO_OF_COURSES > 0) {

                            var ElectiveList = {
                                IS_FLEXIBLE: IS_FLEXIBLE,
                                NO_OF_COURSES: NO_OF_COURSES,
                                LOOP_COUNT: NO_OF_COURSES,
                                ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                IS_CHECKBOX_CHECK: 0
                            }
                            ElectiveCriteria.push(ElectiveList);
                        }
                    }
                });
                $(ElectiveCriteria).each(function (index, row) {
                    var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                    if (distinctGElective.length == 0) {
                        distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 0);
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Global Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                    else if (distinctGElective.length < distinctGElective[0].MIN_NO_OF_COURSES) {
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Global Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                });
                if (ElectiveValidation == true) {
                    return false;
                }
                $("#tblRestudyCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Restudy Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Restudy Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1) {
                            if ($(this).hasClass("Skip-mandatory") == false) {
                                var list = {
                                    COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                                    COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                }
                                CheckEquivalenceMandatory.push(list);
                                MandatoryValidation = true;
                                ErrorMessage = 'Please select the equivalence course for mandatory course';
                            }
                        } else {
                            if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Restudy Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnRestudyCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: $(this).find($('[id^=hdnRestudyEnrollmentSemesterId]')).val(),
                                ENLISTMENT_TYPE: $(this).find($('[id^=hdnRetakeOffer]')).val() == '1' ? 3 : 1,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnRestudyCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblMinorMajorCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Minor Major Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Minor Major Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Minor Major Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=chkMinorMajorOfferChlId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 2,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_minor_major_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }
                        if ($(this).find($('[id^=hdnIsFeeApplicable]')).val() == "1") {
                            var Segement = {
                                MAJOR_MINOR_SEGMENT_ID: $(this).find($('[id^=hdnSegmentId]')).val(),
                                MAJOR_MINOR_CONFIGURATION_ID: $(this).find($('[id^=hdnBucketId]')).val(),
                                CREDITS: Number(CREDITS),
                                MINIMUM_CREDIT: Number($(this).find($('[id^=hdnMinorMajorCredit]')).val()),
                                MAJOR_MINOR_SEGMENT_NAME: $(this).find('td:eq(4)').text().trim(),
                                BUCKET_TITLE: $(this).find('td:eq(5)').text().trim(),
                                RECEIPT_TYPE_ID: $(this).find($('[id^=hdnReceiptTypeId]')).val(),
                                FEESHEAD_ID: $(this).find($('[id^=hdnFeeHeadId]')).val(),
                                AMOUNT: Number($(this).find($('[id^=hdnAmount]')).val()),
                                MST_CURRENCY_ID: Number($(this).find($('[id^=hdnCurrencyId]')).val())
                            }
                            BucketSegmentArray.push(Segement);
                        }
                        //credits += Number($(this).find('td:eq(6)').text().trim());

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblSpecialCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Special Offer Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Special Offer Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Special Offer Course.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 4,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblNotEnlisted tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Not Enlisted Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Not Enlisted Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                        }
                    }
                    if (Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Not Enlisted Courses.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });

                if (validate == true) {
                    return;
                }
                if (EnlistmentArray.length == 0) {
                    iziToast.warning({ message: `Please select atleast one Course !` })
                    return false;
                }
                if (MandatoryValidation == true) {
                    if (ErrorMessage != '') {
                        for (const item of CheckEquivalenceMandatory) {

                            const isAlreadySelected = CourseFinalGridCheck
                                .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                                .some(eq =>
                                    EnlistmentArray.some(en =>
                                        en.COURSE_CREATION_ID == eq.COURSE_CREATION_ID
                                    )
                                );

                            if (!isAlreadySelected) {
                                iziToast.warning({
                                    message: ErrorMessage + ' ' + item.COURSE_CODE
                                });

                                MandatoryValidation = false;
                                break;
                            }
                        }
                        if (MandatoryValidation == false) {
                            return false;
                        }
                    } else {
                        iziToast.warning({ message: `Please select the mandatory course !` })
                        return;
                    }
                }
                for (const item of CheckEquiValidateArray) {

                    const isAlreadySelected = CourseFinalGridCheck
                        .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                        .some(eq =>
                            EnlistmentArray.some(en =>
                                en.COURSE_CREATION_ID == eq.COURSE_CREATION_ID
                            )
                        );

                    if (!isAlreadySelected) {
                        iziToast.warning({
                            message: `The ${item.COURSE_CODE} course is co-requisite. Please select equivalence course for this!`
                        });
                        validate = true;
                        break;
                    }
                }
                for (const item of EnlistmentArray) {

                    const equivalentCourses = CourseFinalGridCheck
                        .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                        .map(x => x.COURSE_CREATION_ID);

                    const selectedFromSameGroup = EnlistmentArray
                        .filter(en => equivalentCourses.includes(en.COURSE_CREATION_ID));

                    if (selectedFromSameGroup.length > 1) {
                        iziToast.warning({
                            message: 'You can not select more than 1 equivalence course for ' + item.COURSE_CODE + ' - ' + item.COURSE_NAME
                        });
                        validate = true;
                        break;
                    }
                }
                if (validate == true) {
                    return;
                }
                //else if (EnlistmentMethod == 1) {
                //    if ($("#ddlStep2Section").val() == 0) {
                //        iziToast.warning({ message: 'Please select Block Section for selected courses !' })
                //        return false;
                //    }
                //}
                // Initialize a variable to hold the sum of credits

                $.each(BucketSegmentArray.map(x => x.MAJOR_MINOR_SEGMENT_ID).filter(function (itm, i, a) {
                    return i == a.indexOf(itm);
                }), function (index, value) {
                    $.each(BucketSegmentArray.filter(x => x.MAJOR_MINOR_SEGMENT_ID == value).map(x => x.MAJOR_MINOR_CONFIGURATION_ID).filter(function (itm, i, a) {
                        return i == a.indexOf(itm);
                    }), function (index, value1) {
                        const segmentCreditSum = BucketSegmentArray
                            .filter(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1)
                            .reduce((sum, item) => sum + item.CREDITS, 0);
                        //if (segmentCreditSum < (BucketSegmentArray
                        //    .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).MINIMUM_CREDIT)) {
                        //    iziToast.warning({
                        //        message: `You can't select less than ` + (BucketSegmentArray
                        //            .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).MINIMUM_CREDIT) + ' Credits for bucket ' +
                        //            (BucketSegmentArray
                        //                .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).BUCKET_TITLE)
                        //    });
                        //    ValidateMinorMajor = true;
                        //    return false;
                        //}
                    })
                })
                DistinctAmountArray = [];
                $.each(BucketSegmentArray, function (index, row) {
                    if (!DistinctAmountArray.find(x => x.MAJOR_MINOR_SEGMENT_ID == row.MAJOR_MINOR_SEGMENT_ID && x.MAJOR_MINOR_CONFIGURATION_ID == row.MAJOR_MINOR_CONFIGURATION_ID)) {
                        DistinctAmountArray.push(row);
                        totalMinorMajorAmount += row.AMOUNT;
                    }
                });
                //const MinorMajorAmount = BucketSegmentArray
                //    .filter(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1)
                //    .reduce((sum, item) => sum + item.AMOUNT, 0);
                //totalMinorMajorAmount += MinorMajorAmount;
                if (ValidateMinorMajor == true) {
                    return false;
                }
                //if (Is_remaining_select == 0 && Is_minor_major_select == 1) {
                //    Is_minor_major_select = 1;
                //} else {
                if (maximumCredits < credits) {
                    iziToast.warning({ message: `You can't select more than ` + maximumCredits + ' Credits.' })
                    return false;
                }
                if (minimumCredits > credits) {
                    iziToast.warning({ message: `You can't select less than ` + minimumCredits + ' Credits.' })
                    return false;
                }
                if (credits === undefined || credits === null || String(credits).toUpperCase() === "NAN") {
                    iziToast.warning({ message: `An error occurred while verifying the credit limit !` })
                    return false;
                }
                //}

                if (BucketSegmentArray.length > 0) {
                    if (totalMinorMajorAmount > 0) {
                        if (BucketSegmentArray[0].MST_CURRENCY_ID == 0) {
                            iziToast.warning({ message: `Standard fees not defined.` })
                            return false;
                        }
                    }
                }
                if ((Is_Late_Fee == 1 && Late_Fee_Amount > 0)) {
                    if (mstCurrencyId == 0) {
                        iziToast.warning({ message: `Standard fees not defined.` })
                        return false;
                    }
                }

                $('#viewTermsAndConditionsModal').modal('hide');

                Swal.fire({
                    title: 'Final Confirmation',
                    html: 'Are you sure you want to submit? Once submitted, you will not be able to make any further changes.',
                    icon: "success",
                    showCancelButton: true,
                    confirmButtonText: 'Yes',
                    cancelButtonText: 'No',
                }).then((result) => {
                    if (result.isConfirmed) {
                        CheckClash(EnlistmentClashArray);

                        if (ClashStatus == 0) {
                            Swal.fire({
                                title: 'Clash Occured',
                                html: ClashStatus.split("$$")[0],
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: 'Ok',
                                cancelButtonText: 'Cancel',
                                width: '700px',
                            });
                            return false;
                        }
                        if (ClashStatus != 1) {
                            Swal.fire({
                                title: 'Clash Occured',
                                html: ClashStatus.split("$$")[0],
                                icon: "warning",
                                showCancelButton: true,
                                confirmButtonText: 'Ok',
                                cancelButtonText: 'Cancel',
                                width: '700px',
                            }).then((result) => {
                                const status = ClashStatus.split("$$")[1];
                                if (result.isConfirmed && status != 1) {
                                    return false;
                                } else if (result.isConfirmed && status == 1) {
                                    FinalConfimSubmit = 1;
                                    SubmitEnlistment(EnlistmentArray, BucketSegmentArray, EnlistmentFeeArray, FinalConfimSubmit, EnlistmentAdditionalDetails);
                                }
                            });
                        }
                        else if (ClashStatus == 1) {
                            FinalConfimSubmit = 1;
                            SubmitEnlistment(EnlistmentArray, BucketSegmentArray, EnlistmentFeeArray, FinalConfimSubmit, EnlistmentAdditionalDetails);
                        }
                    }
                });
            } catch (error) {
                console.error(error);

            }
        });
        /*
NAME  :btnRedirectStudentHold
DESC  :Redirect on student hold page
PARAMS:NA
OUTPUT:NA
*/
        $(document).on('click', '#btnRedirectStudentHold', function () {
            window.open(location.origin + "/STDStudentHold/Index")
        });
        /*
NAME  :SaveEnlistmentData
DESC  :save list of selected subjects
PARAMS:ACADEMIC_SESSION_ID,CAMPUSNO,CURRICULUM_CREATION_ID,ENROLLMENT_SEMESTER_ID,INSTITUTE_CREATION_ID,ACTIVE,CourseSelectionList list,IS_EXAM_REGISTRATION,IS_AUTO_ADVISING,ENLISTMENT_METHOD,SECTION_CREATION_ID,COMMAND_TYPE,ENLISTMENT_RULE_ID,ENLISTMENT_RULE_ALLOCATION_ID,INSTITUTE_CREATION_ID,CREATEDBY,IPADDRESS,INSTITUTE_CREATION_ID
OUTPUT:r_out return value 1 or more
*/
        $('#btnEnlistment').click(function () {
            try {
                var EnlistmentArray = new Array();
                var EnlistmentFeeArray = new Array();
                var credits = 0;
                var validate = false; var ValidateMinorMajor = false; var MandatoryValidation = false;
                var BucketSegmentArray = new Array();
                var ElectiveCriteria = new Array();
                var ElectiveValidation = false; var Is_minor_major_select = 0; var Is_remaining_select = 0;
                var EnlistmentClashArray = new Array();
                var EnlistmentAdditionalDetails = new Array();
                var CheckEquivalenceData = new Array();
                var CheckEquivalenceMandatory = new Array();
                var CheckEquiValidateArray = new Array();
                var ErrorMessage = '';

                $("#tblRegularCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkCourseOfferChlId]')).data("mandatory");
                    const IsLockCore = $(this).find($('[id ^= chkCourseOfferChlId]')).data("lockcore");
                    const check = $(this).find($('[id ^= chkCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Core Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                        return false;
                    }
                    if (IsLockCore == 1 && oneway == 0 && requisiteStatus == 0 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-LockCourse") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1) {
                            if ($(this).hasClass("Skip-mandatory") == false) {
                                var list = {
                                    COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                    COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                }
                                CheckEquivalenceMandatory.push(list);
                                MandatoryValidation = true;
                                ErrorMessage = 'Please select the equivalence course for mandatory course';
                                //return;
                            }
                        } else {
                            if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblElectiveCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES, ELECTIVE_GROUP_ID, ELECTIVE_GROUP_NAME, MIN_NO_OF_COURSES] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("elective").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkECourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkECourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkECourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkECourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Elective Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Elective Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Elective Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }

                            if (NO_OF_COURSES > 0) {
                                var ElectiveList = {
                                    IS_FLEXIBLE: IS_FLEXIBLE,
                                    NO_OF_COURSES: NO_OF_COURSES,
                                    LOOP_COUNT: NO_OF_COURSES,
                                    ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                    MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                    ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                    IS_CHECKBOX_CHECK: 1
                                }
                                ElectiveCriteria.push(ElectiveList);
                                var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                                if (distinctGElective.length > NO_OF_COURSES) {
                                    ElectiveValidation = true;
                                    iziToast.warning({
                                        message: 'Maximum Selected Elective Courses Should Be ' + NO_OF_COURSES + ' For ' + ELECTIVE_GROUP_NAME
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 1,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    } else {
                        if (MIN_NO_OF_COURSES > 0) {

                            var ElectiveList = {
                                IS_FLEXIBLE: IS_FLEXIBLE,
                                NO_OF_COURSES: NO_OF_COURSES,
                                LOOP_COUNT: NO_OF_COURSES,
                                ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                IS_CHECKBOX_CHECK: 0
                            }
                            ElectiveCriteria.push(ElectiveList);
                        }
                    }
                });
                $(ElectiveCriteria).each(function (index, row) {
                    var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                    if (distinctGElective.length == 0) {
                        distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 0);
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Elective Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                    else if (distinctGElective.length < distinctGElective[0].MIN_NO_OF_COURSES) {
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Elective Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                });
                if (ElectiveValidation == true) {
                    return false;
                }
                $("#tblGlobalCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES, ELECTIVE_GROUP_ID, ELECTIVE_GROUP_NAME, MIN_NO_OF_COURSES] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("gelective").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Global Elective Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Global Elective Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Global Elective Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }

                            if (NO_OF_COURSES > 0) {
                                var ElectiveList = {
                                    IS_FLEXIBLE: IS_FLEXIBLE,
                                    NO_OF_COURSES: NO_OF_COURSES,
                                    LOOP_COUNT: NO_OF_COURSES,
                                    ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                    MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                    ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                    IS_CHECKBOX_CHECK: 1
                                }
                                ElectiveCriteria.push(ElectiveList);
                                var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                                if (distinctGElective.length > NO_OF_COURSES) {
                                    ElectiveValidation = true;
                                    iziToast.warning({
                                        message: 'Maximum Selected Global Elective Courses Should Be ' + NO_OF_COURSES + ' For ' + ELECTIVE_GROUP_NAME
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 1,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    } else {
                        if (MIN_NO_OF_COURSES > 0) {

                            var ElectiveList = {
                                IS_FLEXIBLE: IS_FLEXIBLE,
                                NO_OF_COURSES: NO_OF_COURSES,
                                LOOP_COUNT: NO_OF_COURSES,
                                ELECTIVE_GROUP_ID: ELECTIVE_GROUP_ID,
                                MIN_NO_OF_COURSES: MIN_NO_OF_COURSES,
                                ELECTIVE_GROUP_NAME: ELECTIVE_GROUP_NAME,
                                IS_CHECKBOX_CHECK: 0
                            }
                            ElectiveCriteria.push(ElectiveList);
                        }
                    }
                });
                $(ElectiveCriteria).each(function (index, row) {
                    var distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 1);
                    if (distinctGElective.length == 0) {
                        distinctGElective = ElectiveCriteria.filter(x => x.ELECTIVE_GROUP_ID == row.ELECTIVE_GROUP_ID && x.IS_CHECKBOX_CHECK == 0);
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Global Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                    else if (distinctGElective.length < distinctGElective[0].MIN_NO_OF_COURSES) {
                        ElectiveValidation = true;
                        iziToast.warning({
                            message: 'Minimum Selected Global Courses Should Be ' + distinctGElective[0].MIN_NO_OF_COURSES + ' For ' + distinctGElective[0].ELECTIVE_GROUP_NAME
                        });
                        return false;
                    }
                });
                if (ElectiveValidation == true) {
                    return false;
                }
                $("#tblRestudyCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Restudy Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Restudy Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /* if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Restudy Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnRestudyCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: $(this).find($('[id^=hdnRestudyEnrollmentSemesterId]')).val(),
                                ENLISTMENT_TYPE: $(this).find($('[id^=hdnRetakeOffer]')).val() == '1' ? 3 : 1,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnRestudyCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblMinorMajorCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Minor Major Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Minor Major Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Minor Major Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkMinorMajorOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=chkMinorMajorOfferChlId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 2,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_minor_major_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        if ($(this).find($('[id^=hdnIsFeeApplicable]')).val() == "1") {
                            var Segement = {
                                MAJOR_MINOR_SEGMENT_ID: $(this).find($('[id^=hdnSegmentId]')).val(),
                                MAJOR_MINOR_CONFIGURATION_ID: $(this).find($('[id^=hdnBucketId]')).val(),
                                CREDITS: Number(CREDITS),
                                MINIMUM_CREDIT: Number($(this).find($('[id^=hdnMinorMajorCredit]')).val()),
                                MAJOR_MINOR_SEGMENT_NAME: $(this).find('td:eq(4)').text().trim(),
                                BUCKET_TITLE: $(this).find('td:eq(5)').text().trim(),
                                RECEIPT_TYPE_ID: $(this).find($('[id^=hdnReceiptTypeId]')).val(),
                                FEESHEAD_ID: $(this).find($('[id^=hdnFeeHeadId]')).val(),
                                AMOUNT: Number($(this).find($('[id^=hdnAmount]')).val()),
                                MST_CURRENCY_ID: Number($(this).find($('[id^=hdnCurrencyId]')).val())
                            }
                            BucketSegmentArray.push(Segement);
                        }
                        //credits += Number($(this).find('td:eq(6)').text().trim());

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblSpecialCourses tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Special Offer Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Special Offer Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Special Offer Course.' })
                                validate = true;
                                return false;
                            }
                        }

                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 4,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });
                $("#tblNotEnlisted tbody tr").each(function () {
                    let [requisiteStatus, isPartialWithdraw] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("requisite").split(",");
                    const IsMandatory = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("mandatory");
                    const check = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("check");
                    const isoneway = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("isoneway");
                    const oneway = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("oneway");
                    let [EquivalenceCourseId, EquivalenceCourseName] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("equivalence").split(",");

                    if ($(this).hasClass("co-req-locked") && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == false) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' co-requisite course in Not Enlisted Course.' });
                        return false;
                    }
                    if (check == 1 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && requisiteStatus == 1) {
                        validate = true;
                        iziToast.warning({ message: `Please Select ` + $(this).find('td:eq(1)').text().trim() + ' in Not Enlisted Course.' })
                        return false;
                    }
                    if (oneway == 1 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == true && IsMandatory == 0) {
                        validate = true;
                        iziToast.warning({ message: `You can not select ` + $(this).find('td:eq(1)').text().trim() + ' because equivalence course is already registered.' })
                        return false;
                    }
                    requisiteStatus = check == 1 ? 0 : requisiteStatus;
                    if (IsMandatory == 1 && oneway == 0 && $(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("Skip-mandatory") == false) {
                        MandatoryValidation = true;
                        return false;
                    }
                    if ($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked") == false && $(this).hasClass("CheckEquiValidate") == true) {
                        var list = {
                            COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                            COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                        }
                        CheckEquiValidateArray.push(list);
                    }
                    if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 0) {
                        if ($(this).hasClass("Skip-mandatory") == false) {
                            var list = {
                                COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                                COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                            }
                            CheckEquivalenceMandatory.push(list);
                            MandatoryValidation = true;
                            ErrorMessage = 'Please select the equivalence course for mandatory course';
                            //return;
                        }
                    }
                    if (Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1 && validate == false && requisiteStatus == 0 && isPartialWithdraw == 0) {
                        /*if (EnlistmentMethod !== 1) {*/
                        if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                            if (IsMandatory == 1 && oneway == 1 && Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1) {
                                if ($(this).hasClass("Skip-mandatory") == false) {
                                    var list = {
                                        COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                                        COURSE_CODE: $(this).find('td:eq(1)').text().trim() + ' - ' + $(this).find('td:eq(2)').text().trim()
                                    }
                                    CheckEquivalenceMandatory.push(list);
                                    MandatoryValidation = true;
                                    ErrorMessage = 'Please select the equivalence course for mandatory course';
                                    //return;
                                }
                            } else {
                                iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Not Enlisted Courses.' })
                                validate = true;
                                return false;
                            }
                        }
                        //}
                        const [CURRICULUM_CREATION_ID, COURSE_CATEGORY_ID, IS_EXCLUDE, CREDITS] = $(this).find($('[id ^= chkNCourseOfferChlId]')).data("fields").split(",");
                        if (!EnlistmentArray.some(item => item.COURSE_CREATION_ID === $(this).find($('[id^=hdnCourseCreationId]')).val())) {
                            var list = {
                                STUDENT_ID: studentId,
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                ACTIVE: $(this).find($('[id^=hdnCrossOffer]')).val() == 0 ? 7 : $(this).find($('[id^=hdnCrossOffer]')).val(),
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                ENLISTMENT_TYPE: 0,
                                CURRICULUM_CREATION_ID: CURRICULUM_CREATION_ID,
                                COURSE_CATEGORY_ID: COURSE_CATEGORY_ID
                            }
                            EnlistmentArray.push(list);
                            var Courselist = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val()
                            }
                            EnlistmentFeeArray.push(Courselist);
                            // For Clash
                            var EnlistmentClash = {
                                COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                                SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                                CAMPUSNO: campusNo
                            }
                            EnlistmentClashArray.push(EnlistmentClash);

                            Is_remaining_select = 1;

                            if (EquivalenceCourseId > 0) {
                                const listEq = {
                                    COURSE_CREATION_ID: EquivalenceCourseId,
                                    COURSE_NAME: EquivalenceCourseName
                                };
                                CheckEquivalenceData.push(listEq);
                            }

                            const alreadyEnlisted = EnlistmentArray.some(
                                x => x.COURSE_CREATION_ID == EquivalenceCourseId
                            );

                            if (alreadyEnlisted) {
                                if (EquivalenceCourseId == $(this).find($('[id^=hdnCourseCreationId]')).val()) {
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + EquivalenceCourseName
                                    });
                                    return false;
                                }
                            } else {
                                const sameEquivalenceCourses = CheckEquivalenceData.filter(
                                    x => x.COURSE_CREATION_ID == EquivalenceCourseId
                                );

                                if (sameEquivalenceCourses.length > 1) {
                                    const courseName = sameEquivalenceCourses[0]?.COURSE_NAME || '';
                                    validate = true;
                                    iziToast.warning({
                                        message: 'You can not select more than 1 equivalence course for ' + courseName
                                    });
                                    return false;
                                }
                            }
                        }
                        if (IS_EXCLUDE == 0) {
                            credits += Number(CREDITS);
                        }

                        var Additionallist = {
                            STUDENT_ID: studentId,
                            IS_PRE_REQUISITE: requisiteStatus,
                            IS_CO_REQUISITE: $(this).hasClass("co-req-locked") ? 1 : 0,
                            IS_ELECTIVE: 0,
                            IS_GLOBAL_ELECTIVE: 0,
                            IS_MANDATORY: IsMandatory,
                            IS_EQUIVALENCE: isoneway
                        }
                        EnlistmentAdditionalDetails.push(Additionallist);
                    }
                });

                if (validate == true) {
                    return;
                }
                if (EnlistmentArray.length == 0) {
                    iziToast.warning({ message: `Please select atleast one Course !` })
                    return false;
                }
                if (MandatoryValidation == true) {
                    if (ErrorMessage != '') {
                        for (const item of CheckEquivalenceMandatory) {

                            const isAlreadySelected = CourseFinalGridCheck
                                .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                                .some(eq =>
                                    EnlistmentArray.some(en =>
                                        en.COURSE_CREATION_ID == eq.COURSE_CREATION_ID
                                    )
                                );

                            if (!isAlreadySelected) {
                                iziToast.warning({
                                    message: ErrorMessage + ' ' + item.COURSE_CODE
                                });

                                MandatoryValidation = false;
                                break;
                            }
                        }
                        if (MandatoryValidation == false) {
                            return false;
                        }
                    } else {
                        iziToast.warning({ message: `Please select the mandatory course !` })
                        return;
                    }
                }
                for (const item of CheckEquiValidateArray) {

                    const isAlreadySelected = CourseFinalGridCheck
                        .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                        .some(eq =>
                            EnlistmentArray.some(en =>
                                en.COURSE_CREATION_ID == eq.COURSE_CREATION_ID
                            )
                        );

                    if (!isAlreadySelected) {
                        iziToast.warning({
                            message: `The ${item.COURSE_CODE} course is co-requisite. Please select equivalence course for this!`
                        });
                        validate = true;
                        break;
                    }
                }
                for (const item of EnlistmentArray) {

                    const equivalentCourses = CourseFinalGridCheck
                        .filter(x => x.EQUIVALANCE_COURSE_CREATION_ID == item.COURSE_CREATION_ID)
                        .map(x => x.COURSE_CREATION_ID);

                    const selectedFromSameGroup = EnlistmentArray
                        .filter(en => equivalentCourses.includes(en.COURSE_CREATION_ID));

                    if (selectedFromSameGroup.length > 1) {
                        iziToast.warning({
                            message: 'You can not select more than 1 equivalence course for ' + item.COURSE_CODE + ' - ' + item.COURSE_NAME
                        });
                        validate = true;
                        break;
                    }
                }
                if (validate == true) {
                    return;
                }
                //else if (EnlistmentMethod == 1) {
                //    if ($("#ddlStep2Section").val() == 0) {
                //        iziToast.warning({ message: 'Please select Block Section for selected courses !' })
                //        return false;
                //    }
                //}
                // Initialize a variable to hold the sum of credits

                $.each(BucketSegmentArray.map(x => x.MAJOR_MINOR_SEGMENT_ID).filter(function (itm, i, a) {
                    return i == a.indexOf(itm);
                }), function (index, value) {
                    $.each(BucketSegmentArray.filter(x => x.MAJOR_MINOR_SEGMENT_ID == value).map(x => x.MAJOR_MINOR_CONFIGURATION_ID).filter(function (itm, i, a) {
                        return i == a.indexOf(itm);
                    }), function (index, value1) {
                        const segmentCreditSum = BucketSegmentArray
                            .filter(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1)
                            .reduce((sum, item) => sum + item.CREDITS, 0);
                        //if (segmentCreditSum < (BucketSegmentArray
                        //    .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).MINIMUM_CREDIT)) {
                        //    iziToast.warning({
                        //        message: `You can't select less than ` + (BucketSegmentArray
                        //            .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).MINIMUM_CREDIT) + ' Credits for bucket ' +
                        //            (BucketSegmentArray
                        //                .find(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1).BUCKET_TITLE)
                        //    });
                        //    ValidateMinorMajor = true;
                        //    return false;
                        //}
                    })
                })
                DistinctAmountArray = [];
                $.each(BucketSegmentArray, function (index, row) {
                    if (!DistinctAmountArray.find(x => x.MAJOR_MINOR_SEGMENT_ID == row.MAJOR_MINOR_SEGMENT_ID && x.MAJOR_MINOR_CONFIGURATION_ID == row.MAJOR_MINOR_CONFIGURATION_ID)) {
                        DistinctAmountArray.push(row);
                        totalMinorMajorAmount += row.AMOUNT;
                    }
                });
                //const MinorMajorAmount = BucketSegmentArray
                //    .filter(item => item.MAJOR_MINOR_SEGMENT_ID == value && item.MAJOR_MINOR_CONFIGURATION_ID == value1)
                //    .reduce((sum, item) => sum + item.AMOUNT, 0);
                //totalMinorMajorAmount += MinorMajorAmount;
                if (ValidateMinorMajor == true) {
                    return false;
                }
                //if (Is_remaining_select == 0 && Is_minor_major_select == 1) {
                //    Is_minor_major_select = 1;
                //} else {
                if (maximumCredits < credits) {
                    iziToast.warning({ message: `You can't select more than ` + maximumCredits + ' Credits.' })
                    return false;
                }
                if (minimumCredits > credits) {
                    iziToast.warning({ message: `You can't select less than ` + minimumCredits + ' Credits.' })
                    return false;
                }
                if (credits === undefined || credits === null || String(credits).toUpperCase() === "NAN") {
                    iziToast.warning({ message: `An error occurred while verifying the credit limit !` })
                    return false;
                }
                //}
                if (BucketSegmentArray.length > 0) {
                    if (totalMinorMajorAmount > 0) {
                        if (BucketSegmentArray[0].MST_CURRENCY_ID == 0) {
                            iziToast.warning({ message: `Standard fees not defined.` })
                            return false;
                        }
                    }
                }
                if ((Is_Late_Fee == 1 && Late_Fee_Amount > 0)) {
                    if (mstCurrencyId == 0) {
                        iziToast.warning({ message: `Standard fees not defined.` })
                        return false;
                    }
                }

                CheckClash(EnlistmentClashArray);

                if (ClashStatus == 0) {
                    Swal.fire({
                        title: 'Clash Occured',
                        html: ClashStatus.split("$$")[0],
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: 'Ok',
                        cancelButtonText: 'Cancel',
                        width: '700px',
                    });
                    return false;
                }
                if (ClashStatus != 1) {
                    Swal.fire({
                        title: 'Clash Occured',
                        html: ClashStatus.split("$$")[0],
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: 'Ok',
                        cancelButtonText: 'Cancel',
                        width: '700px',
                    }).then((result) => {
                        const status = ClashStatus.split("$$")[1];
                        if (result.isConfirmed && status != 1) {
                            return false;
                        } else if (result.isConfirmed && status == 1) {
                            FinalConfimSubmit = 0;
                            SubmitEnlistment(EnlistmentArray, BucketSegmentArray, EnlistmentFeeArray, FinalConfimSubmit, EnlistmentAdditionalDetails);
                        }
                    });
                }
                else if (ClashStatus == 1) {
                    FinalConfimSubmit = 0;
                    SubmitEnlistment(EnlistmentArray, BucketSegmentArray, EnlistmentFeeArray, FinalConfimSubmit, EnlistmentAdditionalDetails);
                }
            } catch (error) {
                console.error(error);

            }
        })
        /*
NAME  :SubmitEnlistment
DESC  :save list of selected subjects
PARAMS:ACADEMIC_SESSION_ID,CAMPUSNO,CURRICULUM_CREATION_ID,ENROLLMENT_SEMESTER_ID,INSTITUTE_CREATION_ID,ACTIVE,CourseSelectionList list,IS_EXAM_REGISTRATION,IS_AUTO_ADVISING,ENLISTMENT_METHOD,SECTION_CREATION_ID,COMMAND_TYPE,ENLISTMENT_RULE_ID,ENLISTMENT_RULE_ALLOCATION_ID,INSTITUTE_CREATION_ID,CREATEDBY,IPADDRESS,INSTITUTE_CREATION_ID
OUTPUT:r_out return value 1 or more
*/
        async function SubmitEnlistment(EnlistmentArray, BucketSegmentArray, EnlistmentFeeArray, FinalConfimSubmit, EnlistmentAdditionalDetails) {
            var formData = {
                ACADEMIC_SESSION_ID: $("#hdfAcademicSessionId").val(),
                CAMPUSNO: campusNo,
                CURRICULUM_CREATION_ID: curriculumCreationId,
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                ACTIVE: 1,
                CourseSelectionList: EnlistmentArray,
                IS_EXAM_REGISTRATION: IsExamRegistration,
                IS_AUTO_ADVISING: Is_AutoAdvising,
                ENLISTMENT_METHOD: EnlistmentMethod,
                SECTION_CREATION_ID: $("#ddlStep2Section").val(),
                COMMAND_TYPE: "INSERT_UPDATE_STUDENT_ENLISTMENT",
                ENLISTMENT_RULE_ID: $("#hdfEnlistmentRuleId").val(),
                ENLISTMENT_RULE_ALLOCATION_ID: $("#hdfRuleAllocationId").val(),
                IS_ALLOW_MULTIPLE_ATTEMPT: IsAllowMultiAttempt,
                LOCKING_EVENT_ID: IsAllowMultiRestriction,
                IS_DOWN_PAYMENT: DownPayCheck,
                IS_FINAL_CONFIRM: FinalConfimSubmit,
                IS_SUBMITTED_USING: 1,
                EnlistmentAdditionalDetails: EnlistmentAdditionalDetails
            };
            if (FinalConfimSubmit == 1) {
                $('#btnConfirmEnlistment').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
             <span class="">Loading...</span>`);
            } else {
                $('#btnEnlistment').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
             <span class="">Loading...</span>`);
            }
            try {
                let data = await $.ajax({
                    url: "/Enlistment_V2/SaveEnlistmentData/",
                    type: "POST",
                    data: JSON.stringify(formData),
                    contentType: "application/json;charset=utf-8"
                });
                //async: false,
                // success: function (data) {
                if (data == "-786") {
                    CommonCallBack(data.substring(0, 4));
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    return false;
                }
                if (data == "-120") {
                    iziToast.warning({ message: `Your admission has already been withdrawn, so you are not eligible to proceed with the enlistment process.` });
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    return false;
                }
                else if (data == "-7") {
                    iziToast.warning({ message: `Enlistment has already been completed.` });
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    return false;
                }
                else if (data == "-777") {
                    iziToast.warning({ message: `You can not select more than defind credits.` });
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    return false;
                }
                $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                if (data == "1") {
                    let LateFeeCall = 0;
                    CommonCallBack(data.substring(0, 3));

                    if (downPaymentEventId == 2) {
                        if (demandpgId == 0) {
                            if (DemandCount == 0) {
                                if (demandAmount != 0 && downPaymentStatus != 5) {
                                    await CreateDownPaymentDemand();
                                    DemandCount++;
                                }
                            }
                        }
                    }
                    if ((Is_Late_Fee == 1 && Late_Fee_Amount > 0 && LateFeeCall == 0)) {
                        await CreateDemandForLateFee();
                        LateFeeCall = 1;
                    }
                    if (BucketSegmentArray.length > 0 && MinorMajorDemandCount == 0) {
                        if (totalMinorMajorAmount > 0) {
                            if (BucketSegmentArray[0].MST_CURRENCY_ID == 0) {
                                iziToast.warning({ message: `Standard fees not defined.` })
                                return false;
                            }
                            var DemandArray = new Array();
                            var list = {
                                FEESHEAD_ID: BucketSegmentArray[0].FEESHEAD_ID,
                                AMOUNT: totalMinorMajorAmount
                            }
                            DemandArray.push(list);

                            var formData = {
                                ACADEMIC_YEAR_ID: academicYearId,
                                STUDENT_ID: studentId,
                                COLLEGE_PROGRAM_ID: collegeProgramid,
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                RECEIPT_TYPE_ID: BucketSegmentArray[0].RECEIPT_TYPE_ID,
                                MST_CURRENCY_ID: BucketSegmentArray[0].MST_CURRENCY_ID,
                                DEMAND_TYPE: MinorMajorDemandPg == 0 ? 'N' : 'O',
                                DEMANDPG_ID: MinorMajorDemandPg,
                                PAGE_NAME: 'Enlistment/index',
                                DEMAND_DETAILS_TBL: DemandArray
                            }

                            let data = await $.ajax({
                                url: "/OnlinePaymentRequest/CreateDemandRequest/",
                                dataType: "json",
                                method: 'post',
                                data: JSON.stringify(formData),
                                contentType: "application/json;charset=utf-8"
                            });
                            //async: false,
                            //success: function (data) {
                            if (data.IS_SUCCESS == 1) {
                                MinorMajorDemandCount = 1;

                                var formLogData = {
                                    ACADEMIC_YEAR_ID: academicYearId,
                                    STUDENT_ID: studentId,
                                    COLLEGE_PROGRAM_ID: collegeProgramid,
                                    ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                    RECEIPT_TYPE_ID: BucketSegmentArray[0].RECEIPT_TYPE_ID,
                                    MST_CURRENCY_ID: BucketSegmentArray[0].MST_CURRENCY_ID,
                                    DEMAND_TYPE: 'Minor Major',
                                    DEMANDPG_ID: MinorMajorDemandPg == 0 ? data.DEMANDPG_ID : MinorMajorDemandPg,
                                    PAGE_NAME: 'Enlistment/index',
                                    FEESHEAD_ID: BucketSegmentArray[0].FEESHEAD_ID,
                                    AMOUNT: totalMinorMajorAmount,
                                    CAMPUSNO: campusNo,
                                    PAYMENT_MODE_NAME: 'Minor Major'
                                }
                                DownPaymentSubmitLog(formLogData);

                                return true;
                            }
                            else if (data == 1) {
                                MinorMajorDemandCount = 1;

                                var formLogData = {
                                    ACADEMIC_YEAR_ID: academicYearId,
                                    STUDENT_ID: studentId,
                                    COLLEGE_PROGRAM_ID: collegeProgramid,
                                    ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                    RECEIPT_TYPE_ID: BucketSegmentArray[0].RECEIPT_TYPE_ID,
                                    MST_CURRENCY_ID: BucketSegmentArray[0].MST_CURRENCY_ID,
                                    DEMAND_TYPE: 'Minor Major',
                                    DEMANDPG_ID: MinorMajorDemandPg == 0 ? data.DEMANDPG_ID : MinorMajorDemandPg,
                                    PAGE_NAME: 'Enlistment/index',
                                    FEESHEAD_ID: BucketSegmentArray[0].FEESHEAD_ID,
                                    AMOUNT: totalMinorMajorAmount,
                                    CAMPUSNO: campusNo,
                                    PAYMENT_MODE_NAME: 'Minor Major'
                                }
                                DownPaymentSubmitLog(formLogData);

                                return true;
                            }
                            else {
                                const message = data.ERROR_MESSAGE || 'Unable to create minor major demand !';
                                iziToast.warning({ message });
                                return false;
                            }

                            //    },
                            //    error: function (err) {
                            //        console.log(err);
                            //    }
                            //});
                        }
                    }

                    /*GetAllDropDown();*/

                    if (downPaymentEventId == 2 && StdApprovalStatus > 0) {
                        if (demandpgId == 0) {
                            if (DemandCount == 0) {
                                if (demandAmount != 0 && downPaymentStatus != 5) {
                                    CreateDownPaymentDemand();
                                    DemandCount++;
                                }
                            }
                        }
                    }
                    if (IsGenerateDemandRuntime == null || IsGenerateDemandRuntime == 1) {
                        await CallEnlistmentFeeAPI(EnlistmentFeeArray);
                    }
                    $('a[href="#STEP3"]').tab('show');
                    await GetEnlistmentApprovalStatus();
                    //GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                    GenerateStudentId({ StudentIdList: [{ STUDENT_ID: studentId, INTAKE_CREATION_ID: intakeCreationId, STUDY_LEVEL_ID: studyLevelId }] })
                }
                else if (data == "0") {
                    iziToast.success({ message: 'Record Save Successfully !' });

                    if ((Is_Late_Fee == 1 && Late_Fee_Amount > 0 && LateFeeCall == 0)) {
                        await CreateDemandForLateFee();
                        LateFeeCall = 1;
                    }
                    if (BucketSegmentArray.length > 0 && MinorMajorDemandCount == 0) {
                        if (totalMinorMajorAmount > 0) {
                            if (BucketSegmentArray[0].MST_CURRENCY_ID == 0) {
                                iziToast.warning({ message: `Standard fees not defined.` })
                                return false;
                            }
                            var DemandArray = new Array();
                            var list = {
                                FEESHEAD_ID: BucketSegmentArray[0].FEESHEAD_ID,
                                AMOUNT: totalMinorMajorAmount
                            }
                            DemandArray.push(list);

                            var formData = {
                                ACADEMIC_YEAR_ID: academicYearId,
                                STUDENT_ID: studentId,
                                COLLEGE_PROGRAM_ID: collegeProgramid,
                                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                RECEIPT_TYPE_ID: BucketSegmentArray[0].RECEIPT_TYPE_ID,
                                MST_CURRENCY_ID: BucketSegmentArray[0].MST_CURRENCY_ID,
                                DEMAND_TYPE: MinorMajorDemandPg == 0 ? 'N' : 'O',
                                DEMANDPG_ID: MinorMajorDemandPg,
                                PAGE_NAME: 'Enlistment/index',
                                DEMAND_DETAILS_TBL: DemandArray
                            }

                            let data = await $.ajax({
                                url: "/OnlinePaymentRequest/CreateDemandRequest/",
                                dataType: "json",
                                method: 'post',
                                data: JSON.stringify(formData),
                                contentType: "application/json;charset=utf-8"
                            });
                            //async: false,
                            //success: function (data) {
                            if (data.IS_SUCCESS == 1) {
                                MinorMajorDemandCount = 1;

                                var formLogData = {
                                    ACADEMIC_YEAR_ID: academicYearId,
                                    STUDENT_ID: studentId,
                                    COLLEGE_PROGRAM_ID: collegeProgramid,
                                    ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                                    RECEIPT_TYPE_ID: BucketSegmentArray[0].RECEIPT_TYPE_ID,
                                    MST_CURRENCY_ID: BucketSegmentArray[0].MST_CURRENCY_ID,
                                    DEMAND_TYPE: 'Minor Major',
                                    DEMANDPG_ID: MinorMajorDemandPg == 0 ? data.DEMANDPG_ID : MinorMajorDemandPg,
                                    PAGE_NAME: 'Enlistment/index',
                                    FEESHEAD_ID: BucketSegmentArray[0].FEESHEAD_ID,
                                    AMOUNT: totalMinorMajorAmount,
                                    CAMPUSNO: campusNo,
                                    PAYMENT_MODE_NAME: 'Minor Major'
                                }
                                DownPaymentSubmitLog(formLogData);

                                return true;
                            }
                            else {
                                const message = data.ERROR_MESSAGE || 'Unable to create minor major demand !';
                                iziToast.warning({ message });
                                return false;
                            }

                            //    },
                            //    error: function (err) {
                            //        console.log(err);
                            //    }
                            //});
                        }
                    }
                    $('a[href="#STEP3"]').tab('show');
                    await GetEnlistmentApprovalStatus();
                    //GetAllDropDown();
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }
                else if (data == "-77") {
                    iziToast.warning({ message: 'Unfortunately you are not eligible for Enlistment !' });
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }
                else if (data == "4") {
                    iziToast.warning({ message: 'Section capacity is full !' });
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }
                else if (data == "-195") {
                    iziToast.warning({ message: 'This student is already registered for the academic session. Please cancel the previous registration in case of any modifications.' });
                    //return false;
                }
                else {
                    iziToast.warning({ message: 'Error occured !' });
                    GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
                    $('#btnEnlistment').removeAttr('disabled').empty().text('Save & Next');
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }

                //},
                //error: function (errResponse) {
                //    console.log(errResponse);
                //}
            } catch (error) {
                console.error(error);

            } finally {
                if (FinalConfimSubmit == 1) {
                    $('#btnConfirmEnlistment')
                        .prop('disabled', false)
                        .text('Final Submit');
                } else {
                    $('#btnEnlistment')
                        .prop('disabled', false)
                        .text('Save & Next');
                }
            }
        }
        /*
NAME  :GetEnlistmentApprovalStatus
DESC  :get Approval status data
PARAMS:AcademicSessionId,EnrollmentSemesterId
OUTPUT:Return List
*/
        async function GetEnlistmentApprovalStatus() {
            var FormData = { academicSessionId: $("#hdfAcademicSessionId").val(), enrollmentSemesterId: enrollmentSemesterId, studyLevelId: studyLevelId, campusNo: campusNo };
            let data = await $.ajax({
                url: "/Enlistment_V2/GetEnlistmentApprovalStatus/",
                type: "POST",
                data: FormData
            });
            //async: false,
            //success: function (data) {
            StdApprovalStatus = data[0].ENLISTMENT_APPROVAL_STATUS_ID;
            IsGenerateDemandRuntime = data[0].IS_GENERATE_DEMAND_RUNTIME;
            IsDemandGenerated = data[0].IS_DEMAND_GENERATED;

            $('#statusEnlistment').empty();
            $('#statusEnlistment').append(EnlistmentStatusFormatter(data[0].ENLISTMENT_APPROVAL_STATUS_ID));
            Enliststatus = data[0].ENLISTMENT_APPROVAL_STATUS_ID;

            if (data.length > 0) {
                if (data[0].IS_MULTIPLE_ALLOW == 1) {
                    if (data[0].ENLISTMENT_APPROVAL_STATUS_ID == 2 || data[0].ENLISTMENT_APPROVAL_STATUS_ID == 3) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                    } else if (data[0].ENLISTMENT_APPROVAL_STATUS_ID == 1 && data[0].MST_LOCKING_EVENT_ID == 4) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                    } else {
                        IsDisabledTab = 0;
                        $('a[href="#STEP1"]').prop('disabled', false);
                        $('a[href="#STEP2"]').prop('disabled', false);
                    }
                }
                else {
                    if (data[0].ENLISTMENT_APPROVAL_STATUS_ID > 0) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                    } else {
                        IsDisabledTab = 0;
                        $('a[href="#STEP1"]').prop('disabled', false);
                        $('a[href="#STEP2"]').prop('disabled', false);
                    }
                } 
            }
            if (data.length > 0) {
                const tbody = $('#tblRegisteredCourses tbody');
                const rows = data.map(item => `
        <tr>
            <td>${item.COURSE_CODE}</td>
            <td>${item.COURSE_NAME}</td>
            <td>${item.COURSE_TYPE_NAME}</td>
            <td>${item.CREDITS}</td>
            <td>${item.SECTION_NAME}</td>
            <td>${item.OVERALL_SCHEDULE}</td>
        </tr>
    `).join('');

                tbody.html(rows);
            }
            else {

                tbody.html(`
        <tr>
            <td colspan="5" class="text-center">
                No records found.
            </td>
        </tr>
    `);
            }
        }
        /*
     NAME  :CheckClash
     DESC  :get time table schedule data
     PARAMS:courseCreationId,STUDENT_ID,INSTITUTE_CREATION_ID
     OUTPUT:STATUS
     */
        function CheckClash(EnlistmentClashArray) {

            var ClashformData = { academicSessionId: $("#hdfAcademicSessionId").val(), CourseList: EnlistmentClashArray };
            $.ajax({
                url: "/Enlistment/GetCourseClashDetails/",
                type: "POST",
                data: ClashformData,
                async: false,
                success: function (data) {
                    if (data[0].STATUS == 1) {
                        ClashStatus = 1;
                    }
                    else {
                        ClashStatus = data[0].STATUS;
                    }
                }
            });
        }
        /*
  NAME  : ddlStep2SectionChangeHandler
  DESC  : Handles the change event on the dropdown element with id "ddlStep2Section". It updates the sections and courses based on the selected SectionId, enabling or disabling checkboxes and displaying warnings if necessary.
  PARAMS: NA
  OUTPUT: NA
*/
        $('#ddlStep2Section').change(function () {
            var SectionId = $(this).val();
            var count = 0;
            if (SectionId > 0) {
                $("#tblRegularCourses tbody tr").each(function () {
                    const [CoreRequisiteStatus, PartialWithDraw] = $(this).find($('[id ^= chkCourseOfferChlId]')).data("requisite").split(",");
                    const check = $(this).find($('[id ^= chkCourseOfferChlId]')).data("check");
                    const IsMandatory = $(this).find($('[id ^= chkCourseOfferChlId]')).data("mandatory");
                    $(this).find($('[id ^= chkCourseOfferChlId]')).next().find('.bi-exclamation').remove();
                    if (CoreRequisiteStatus == 0 && PartialWithDraw == 0 && $(this).find('span').html() != '#') {
                        $(this).find($('[id ^= ddlSection]')).val(SectionId).change();
                    }

                    if (isCoreDisabled != '') {
                        count++;
                        $(this).find($('[id ^= chkCourseOfferChlId]')).prop("disabled", true);
                        $(this).find($('[id ^= chkCourseOfferChlId]')).prop("checked", (CoreRequisiteStatus == 1 || PartialWithDraw == 1) ? false : true);

                        if (!SectionData['SectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkCourseOfferChlId]')).val())) {
                            if ($(this).find('span').html() == '#') {
                                $(this).find(".thEnlistmentMethod").prop("disabled", false);
                            }
                            else {
                                $(this).find($('[id ^= chkCourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                            }
                        }
                    }
                    else if (!SectionData['SectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkCourseOfferChlId]')).val())) {
                        count++;
                        if ($(this).find('span').html() == '#') {
                            $(this).find(".thEnlistmentMethod").prop("disabled", (CoreRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                        }
                        else {
                            $(this).find($('[id ^= chkCourseOfferChlId]')).prop("checked", false);
                            $(this).find($('[id ^= chkCourseOfferChlId]')).prop("disabled", true);
                            $(this).find($('[id ^= chkCourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                        }
                    }
                    else {
                        if ($(this).find('span').html() == '#') {
                            $(this).find(".thEnlistmentMethod").prop("disabled", (CoreRequisiteStatus == 1 || PartialWithDraw == 1) ? true : false);
                            $(this).find($('[id ^= chkCourseOfferChlId]')).prop("disabled", (CoreRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                        }
                        else {
                            $(this).find($('[id ^= chkCourseOfferChlId]')).prop("disabled", (CoreRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                            if (check == 0 && StudentRegistered == 0 && StdApprovalStatus > 0) {
                                $(this).find($('[id ^= chkCourseOfferChlId]')).prop("checked", false);
                            } else {
                                $(this).find($('[id ^= chkCourseOfferChlId]')).prop("checked", (CoreRequisiteStatus == 1 || PartialWithDraw == 1) ? false : true);
                            }
                        }
                    }
                    if (check == 1 && CoreRequisiteStatus == 1) {
                        $(this).find($('[id ^= chkCourseOfferChlId]')).prop("disabled", true);
                        $(this).find($('[id ^= chkCourseOfferChlId]')).prop("checked", true);
                    }
                });
                if ($("#tblRegularCourses tbody tr").length == count) {
                    $('#chkCourseOfferChlId').prop("disabled", true);
                }
                else {
                    $('#chkCourseOfferChlId').prop("checked", false);
                    $('#chkCourseOfferChlId').prop("disabled", false);
                }

                count = 0;
                $("#tblElectiveCourses tbody tr").each(function () {
                    const [ElectiveRequisiteStatus, PartialWithDraw] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES] = $(this).find($('[id ^= chkECourseOfferChlId]')).data("elective").split(",");
                    const check = $(this).find($('[id ^= chkECourseOfferChlId]')).data("check");
                    const IsMandatory = $(this).find($('[id ^= chkECourseOfferChlId]')).data("mandatory");
                    $(this).find($('[id ^= chkECourseOfferChlId]')).next().find('.bi-exclamation').remove();
                    if (ElectiveRequisiteStatus == 0 && PartialWithDraw == 0 && $(this).find('span').html() != '#') {
                        $(this).find($('[id ^= ddlSection]')).val(SectionId).change();
                    }
                    if (!SectionData['SectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkECourseOfferChlId]')).val())) {
                        count++;
                        if ($(this).find('span').html() == '#') {
                            $(this).find(".thEnlistmentMethod").prop("disabled", (ElectiveRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                        }
                        else {
                            $(this).find($('[id ^= chkECourseOfferChlId]')).prop("checked", false);
                            $(this).find($('[id ^= chkECourseOfferChlId]')).prop("disabled", true);
                            $(this).find($('[id ^= chkECourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                        }
                    }
                    else {
                        $(this).find($('[id ^= chkECourseOfferChlId]')).prop("disabled", (ElectiveRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                    }
                    if (check == 1 && ElectiveRequisiteStatus == 1) {
                        $(this).find($('[id ^= chkECourseOfferChlId]')).prop("disabled", true);
                        $(this).find($('[id ^= chkECourseOfferChlId]')).prop("checked", true);
                    }
                });
                if ($("#tblElectiveCourses tbody tr").length == count) {
                    $('#chkECourseOfferChlId').prop("disabled", true);
                }
                else {
                    $('#chkECourseOfferChlId').prop("checked", false);
                    $('#chkECourseOfferChlId').prop("disabled", false);
                }

                count = 0;

                $("#tblGlobalCourses tbody tr").each(function () {
                    const [GlobalRequisiteStatus, PartialWithDraw] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("requisite").split(",");
                    const [IS_FLEXIBLE, NO_OF_COURSES] = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("gelective").split(",");
                    const check = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("check");
                    const IsMandatory = $(this).find($('[id ^= chkGCourseOfferChlId]')).data("mandatory");
                    $(this).find($('[id ^= chkGCourseOfferChlId]')).next().find('.bi-exclamation').remove();
                    if (GlobalRequisiteStatus == 0 && PartialWithDraw == 0 && $(this).find('span').html() != '#') {
                        $(this).find($('[id ^= ddlSection]')).val(SectionId).change();
                    }
                    if (!SectionData['SectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkGCourseOfferChlId]')).val())) {
                        count++;
                        if ($(this).find('span').html() == '#') {
                            $(this).find(".thEnlistmentMethod").prop("disabled", (GlobalRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                        }
                        else {
                            $(this).find($('[id ^= chkGCourseOfferChlId]')).prop("checked", false);
                            $(this).find($('[id ^= chkGCourseOfferChlId]')).prop("disabled", true);
                            $(this).find($('[id ^= chkGCourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                        }
                    }
                    else {
                        $(this).find($('[id ^= chkGCourseOfferChlId]')).prop("disabled", (GlobalRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1 || $(this).hasClass("co-req-locked")) ? true : false);
                    }
                    if (check == 1 && GlobalRequisiteStatus == 1) {
                        $(this).find($('[id ^= chkGCourseOfferChlId]')).prop("disabled", true);
                        $(this).find($('[id ^= chkGCourseOfferChlId]')).prop("checked", true);
                    }
                });

                if ($("#tblGlobalCourses tbody tr").length == count) {
                    $('#chkGCourseOfferChlId').prop("disabled", true);
                }
                else {
                    $('#chkGCourseOfferChlId').prop("checked", false);
                    $('#chkGCourseOfferChlId').prop("disabled", false);
                }
                //count = 0;
                //$("#tblSpecialCourses tbody tr").each(function () {
                //    const [SpecialRequisiteStatus, PartialWithDraw] = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("requisite").split(",");
                //    const check = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("check");
                //    const IsMandatory = $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).data("mandatory");
                //    $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).next().find('.bi-exclamation').remove();
                //    if (SpecialRequisiteStatus == 0 && PartialWithDraw == 0) {
                //        $(this).find($('[id ^= ddlSection]')).val(SectionId).change();
                //    }
                //    if (!SectionData['SectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkSpecialCourseOfferChlId]')).val())) {
                //        count++;
                //        if ($(this).find('span').html() == '#') {
                //            $(this).find(".thEnlistmentMethod").prop("disabled", (SpecialRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1) ? true : false);
                //        }
                //        else {
                //            $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).prop("checked", false);
                //            $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).prop("disabled", true);
                //            $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                //        }
                //    }
                //    else {
                //        $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).prop("disabled", (SpecialRequisiteStatus == 1 || PartialWithDraw == 1 || IsMandatory == 1) ? true : false);
                //    }
                //    if (check == 1 && SpecialRequisiteStatus == 1) {
                //        $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).prop("disabled", true);
                //        $(this).find($('[id ^= chkSpecialCourseOfferChlId]')).prop("checked", true);
                //    }
                //});
                //if ($("#tblSpecialCourses tbody tr").length == count) {
                //    $('#chkSpecialCourseOfferChlId').prop("disabled", true);
                //}
                //else {
                //    $('#chkSpecialCourseOfferChlId').prop("checked", false);
                //    $('#chkSpecialCourseOfferChlId').prop("disabled", false);
                //}
                //count = 0;
                //$("#tblRestudyCourses tbody tr").each(function () {
                //    $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).next().find('.bi-exclamation').remove();
                //    $(this).find($('[id ^= ddlSection]')).val(SectionId).select2();
                //    if (!SectionData['GetRestudySectionDetails'].find(x => x.SECTION_CREATION_ID == SectionId && x.COURSE_CREATION_ID == $(this).find($('input[name=chkRestudyCourseOfferChlId]')).val())) {
                //        count++;
                //        if ($(this).find('span').html() == '#') {
                //            $(this).find(".thEnlistmentMethod").prop("disabled", false);
                //        }
                //        else {
                //            $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).prop("checked", false);
                //            $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).prop("disabled", true);
                //            $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).next().append('<i class="bi bi-exclamation text-danger fa-2x"></i>')
                //        }
                //    }
                //    else {
                //        $(this).find($('[id ^= chkRestudyCourseOfferChlId]')).prop("disabled", false);
                //    }
                //});
                //if ($("#tblRestudyCourses tbody tr").length == count) {
                //    $('#chkRestudyCourseOfferChlId').prop("disabled", true);
                //}
                //else {
                //    $('#chkRestudyCourseOfferChlId').prop("checked", false);
                //    $('#chkRestudyCourseOfferChlId').prop("disabled", false);
                //}
                if (EnlistmentMethod == 1 && StudentRegistered == 0 && StdApprovalStatus > 0) {
                    $(".chkAll").prop('checked', false);
                } else {
                    $(".chkAll").prop('checked', true);
                }
                ShoWAlertOnBlockSection = 1;
                buildCourseLookup();
                ShoWAlertOnBlockSection = 0;
            }
            else {
                //GetSectionList($("#hdfAcademicSessionId").val());
                GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
            }
        })

        /*
         NAME  :CallEnlistmentFeeAPI
         DESC  :calculate student enlistment fees
         PARAMS:STUDENT_ID,COLLEGE_PROGRAM_ID,ENROLLMENT_SEMESTER_ID,ENROLLMENT_PAYMENT_TYPE_ID,INSTITUTE_CREATION_ID,CREATEDBY,IPADDRESS,COURSES_TBL list
         OUTPUT:r_out return value 1 or more
     */

        async function CallEnlistmentFeeAPI(COURSE_CREATION_ID) {

            var formData = {
                STUDENT_ID: studentId,
                COLLEGE_PROGRAM_ID: collegeProgramid,
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                ENROLLMENT_PAYMENT_TYPE_ID: PaymentTypeId,
                COURSES_TBL: COURSE_CREATION_ID,
                IS_CANCEL: '0',
                ACADEMIC_SESSION_ID: $("#hdfAcademicSessionId").val()
            };

            var formLogData = {
                ACADEMIC_YEAR_ID: academicYearId,
                STUDENT_ID: studentId,
                COLLEGE_PROGRAM_ID: collegeProgramid,
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                RECEIPT_TYPE_ID: 0, 
                MST_CURRENCY_ID: 0,
                DEMAND_TYPE: 'Enlistment Fees Computation',
                DEMANDPG_ID: 0,
                PAGE_NAME: 'Enlistment_V2/index',
                FEESHEAD_ID: 0,
                AMOUNT: 0,
                CAMPUSNO: '0',
                PAYMENT_MODE_NAME: 'Enlistment'
            }
            $.ajax({
                url: "/Enlistment/CreateDemandRequestLog/",
                dataType: "json",
                method: 'post',
                data: JSON.stringify(formLogData),
                contentType: "application/json;charset=utf-8",
                success: function (data) {

                }
            });

            let data = await $.ajax({
                url: "/Enlistment/CalculateEnlistmentFee/",
                type: "POST",
                data: JSON.stringify(formData),
                contentType: "application/json;charset=utf-8"
            });
            //async: false,
            //success: function (data) {
            if (data == "1") {
                return true;
            }
            else if (data == "-1") {
                iziToast.warning({ message: 'Unable to create Recievable, Payment Type is missing for you !' });
            }
            else if (data == "-2") {
                iziToast.warning({ message: 'Unable to create Recievable, Fees structure is not avaialble !' });
            }
            else if (data == "-3") {
                iziToast.warning({ message: 'Unable To Calculate Enlistment Fees !' });
            }
            else {
                CommonCallBack(data.substring(0, 3));
            }

            //    },
            //    error: function (errResponse) {
            //        console.log(errResponse);
            //    }
            //});
        }
        /*
         NAME  :btnAdd
         DESC  :save enlistment method
         PARAMS:ACADEMIC_SESSION_ID,ENLISTMENT_METHOD,ENROLLMENT_SEMESTER_ID,COMMAND_TYPE,CourseSelectionList list
         OUTPUT:r_out return value 1 or more
     */
        $('#btnAdd').click(async function () {
            AlreadyLoadData = 0;
            if (isDownPayment == 1) {
                if (downPaymentEventId == 1) {
                    if (demandAmount == 0 && downPaymentStatus == 5) {
                        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                    }
                    else if (downPaymentStatus != 1) {
                        iziToast.warning({ message: `Please complete your down-payment inorder to proceed for Enlistment !` })
                        return false;
                    }
                }
            }
            if (StudentDetails['EnlistmentRuleConfiguration'][0].IS_BLOCK_SECTION == 0) {
                $("#rdoBlockSection").prop("checked", false);
            }
            else if (StudentDetails['EnlistmentRuleConfiguration'][0].IS_OPEN_SECTION == 0) {
                $("#rdoOpenSection").prop("checked", false);
            }
            else if (StudentDetails['EnlistmentRuleConfiguration'][0].IS_FIXED_SECTION == 0) {
                $("#rdoFixedSection").prop("checked", false);
            }
            if ($("input[name='EnrollmentOption']:checked").val() == '' || $("input[name='EnrollmentOption']:checked").val() == null) {
                iziToast.warning({ message: `Please Select Enrollment Method.` })
                return false;
            }
            if (IsSlotActive == 1) {
                if ($('#ddlTimeSlot').val() == "0") {
                    CommonWarningMsg('#ddlTimeSlot');
                    return false;
                }
            }
            var EnlistmentArray = new Array();
            var list = {
                STUDENT_ID: studentId,
                COURSE_CREATION_ID: 0,
                SECTION_CREATION_ID: 0,
                ACTIVE: 1,
                ENROLLMENT_SEMESTER_ID: 0
            }
            EnlistmentArray.push(list);

            var EnlistmentAdditionalDetails = new Array();

            var Additionallist = {
                STUDENT_ID: 0,
                IS_PRE_REQUISITE: 0,
                IS_CO_REQUISITE: 0,
                IS_ELECTIVE: 0,
                IS_GLOBAL_ELECTIVE: 0,
                IS_MANDATORY: 0,
                IS_EQUIVALENCE: 0
            }
            EnlistmentAdditionalDetails.push(Additionallist);

            var formData = {
                ACADEMIC_SESSION_ID: $("#hdfAcademicSessionId").val(),
                ENLISTMENT_METHOD: $("input[name='EnrollmentOption']:checked").val(),
                ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
                COMMAND_TYPE: "INSERT_UPDATE_STUDENT_ENLISTMENT_METHOD",
                CourseSelectionList: EnlistmentArray,
                SLOT_ID: $('#ddlTimeSlot').val(),
                IS_SUBMITTED_USING: 1,
                EnlistmentAdditionalDetails: EnlistmentAdditionalDetails
            };
            try {
                $('#btnAdd').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
             <span class="">Loading...</span>`);
                let data = await $.ajax({
                    url: "/Enlistment_V2/SaveEnlistmentData/",
                    type: "POST",
                    data: JSON.stringify(formData),
                    contentType: "application/json;charset=utf-8"
                });
                //async: false,
                //success: function (data) {
                $('#btnAdd').removeAttr('disabled').empty().text('Save & Next');
                $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                CommonCallBack(data.substring(0, 3));
                //GetSectionList($("#hdfAcademicSessionId").val());
                //GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
                $('a[href="#STEP2"]').tab('show');
                $('a[href="#STEP2"]').click();
                enrollmentMethod = $("input[name='EnrollmentOption']:checked").val();
                slotId = $('#ddlTimeSlot').val();
                $("#divPayStatus").addClass("d-none");
            } catch (error) {
                console.error(error);

            } finally {
                $('#btnAdd')
                    .prop('disabled', false)
                    .text('Save & Next');
            }
            //},
            //error: function (errResponse) {
            //    console.log(errResponse);
            //}


        })
        $('#btnEnlistmentClose').click(function () {
            GetAllCourseSectionData($("#hdfAcademicSessionId").val(), $("#hdfRuleAllocationId").val(), $("#hdfEnlistmentRuleId").val());
        })
        $('#btnPaymentPreview').click(function () {
            PreviewEnlistmentFee();
        })

    }

    /*
         NAME  :PreviewEnlistmentFee
         DESC  :show amount preview as selected subject wise
         PARAMS:STUDENT_ID,COLLEGE_PROGRAM_ID,ENROLLMENT_SEMESTER_ID,ENROLLMENT_PAYMENT_TYPE_ID,INSTITUTE_CREATION_ID,CREATEDBY,IPADDRESS,COURSES_TBL list
         OUTPUT:TOTAL_FEES,DOWN_PAYMENT,TOTAL_PAYMENT,EXCESS_PAYMENT,OUTSTANDING_BALANCE,TOTAL_DISCOUNT,FINAL_BALANCE,DEMAND_DETAILS list,INSTALLMENT_DETAILS list,COURSE_FEES_DETAILS list
     */
    var PreviewEnlistmentFee = async function () {
        var CourseList = new Array();
        $("#tblRegularCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({
                    COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                    IS_SPECIAL: 0,
                    CAMPUSNO: campusNo
                });
            }
        });
        $("#tblElectiveCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblGlobalCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblRestudyCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblMinorMajorCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblSpecialCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 1, CAMPUSNO: campusNo });
            }
        });
        $("#tblNotEnlisted tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        if (CourseList.length == 0) {
            iziToast.warning({ message: 'Please select atleast one Course !' });
            $("#PaymentPreviewModal").modal('hide');
            return false;
        }
        else {
            $("#PaymentPreviewModal").modal('show');
            $('#tblViewOtherPaymentPlan').parent().addClass('hide');
        }
        DistinctCourses = [];
        $.each(CourseList, function (index, row) {
            if (!DistinctCourses.find(x => x.COURSE_CREATION_ID == row.COURSE_CREATION_ID)) {
                DistinctCourses.push(row);
            }
        })
        var Formdata = { COLLEGE_PROGRAM_ID: collegeProgramid, ENROLLMENT_SEMESTER_ID: enrollmentSemesterId, ENROLLMENT_PAYMENT_TYPE_ID: PaymentTypeId, COURSES_TBL: DistinctCourses, ACADEMIC_SESSION_ID: $("#hdfAcademicSessionId").val() }
        $('#btnPaymentPreview').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
  <span class="">Loading...</span>`);
        try {
            let data = await $.ajax({
                url: "/Enlistment/PreviewEnlistmentFee/",
                type: 'post',
                data: Formdata,
                dataType: "json"
            });
            //async: false,
            //success: function (data) {

            //$('#Fees').text(data.TOTAL_FEES);
            //$('#ProcessingFee').text('0');
            $('#ulPreviewFee').empty();
            $('#TotalAmount').text(data.FINAL_BALANCE);
            $('#tblInstallment tbody').empty();

            var htmlString = `<li>
                                <span class="tag fw-bold">Payments</span>
                                <span class="value text-end fw-bold">Amount</span>
                            </li>
                            `;
            $.each(data["DEMAND_DETAILS"], function (index, row) {
                htmlString += `<li>
                                <span class="tag">${row.FEESHEAD_NAME}</span>
                                <span class="value text-end" id="Fees">${row.AMOUNT}</span>
                            </li>`;
            });
            htmlString += `<li>
                                <span class="tag"><b>Total Fees</b></span>
                                <span class="value text-end" id="Fees"><b>${data.TOTAL_FEES}</b></span>
                            </li>
                            <li>
                                <span class="tag">Down Payment</span>
                                <span class="value text-end text-danger" id="Fees">-${data.DOWN_PAYMENT}</span>
                            </li>
                             <li>
                                <span class="tag">Scholarship</span>
                                <span class="value text-end text-danger" id="Fees">-${data.TOTAL_DISCOUNT}</span>
                            </li>
                            <li>
                                <span class="tag">Excess Scholarship</span>
                                <span class="value text-end" id="Fees">${data.EXCESS_SCHOLARSHIP_AMOUNT}</span>
                            </li>
                            `;
            $('#ulPreviewFee').append(htmlString);
            $("#spnOverallCharge").html('-');
            if (data["INSTALLMENT_DETAILS"].length > 0) {
                $(".clsInstallment").removeClass("d-none");
                $('#divShowInstallment').removeClass("d-none");

                if (data["INSTALLMENT_DETAILS"][0].IS_OVERALL_CHARGES == 1) {
                    $("#spnOverallCharge").html(data["INSTALLMENT_DETAILS"][0].CHARGES_AMOUNT);
                    $('#divOverAllcharge').removeClass("d-none"); $('#CheckFlag').addClass("d-none");
                } else {
                    $("#spnOverallCharge").html('-');
                    $('#divOverAllcharge').addClass("d-none"); $('#CheckFlag').removeClass("d-none");
                }

                $.each(data["INSTALLMENT_DETAILS"], function (index, row) {
                    var html = `<tr>
                                       <td>Installment - ${row.INSTALLMENT_NO}</td>
                                       <td>${row.AMOUNT}</td>
                                       <td>${row.INSTALLMENT_DATE == null ? "" : row.INSTALLMENT_DATE}</td>
                                       <td>${row.PAID_AMOUNT}</td>
                                       <td>${row.SCHOLARSHIP_AMOUNT}</td>
                                       <td>${row.BALANCE_AMOUNT}</td>`
                    if (data["INSTALLMENT_DETAILS"][0].IS_OVERALL_CHARGES == 0) {
                        html += `<td>${row.CHARGES_AMOUNT}</td>`
                    }
                    if (row.INSTALLMENT_STATUS == 0) {
                        html += `<td><span class="badge badge-warning badge-outline">Unpaid</span></td>
                                   </tr>`;
                    }
                    else if (row.INSTALLMENT_STATUS == 1) {
                        html += `<td><span class="badge badge-success badge-outline">Paid</span></td>
                                   </tr>`;
                    }
                    $('#tblInstallment tbody').append(html);
                })
            } else {
                $('#divShowInstallment').removeClass("d-none"); $('#divOverAllcharge').addClass("d-none");
                $(".clsInstallment").addClass("d-none");
            }
            RenderDropDown($('#ddlPPPaymentPlan'), data["PAYMENT_PLAN_DRP"], 'INSTALLMENT_PAYMENT_PLAN_CONFIG_ID', 'PAYMENT_PLAN_TITLE');
            // }
        } catch (error) {
            console.error(error);

        } finally {
            $('#btnPaymentPreview')
                .prop('disabled', false)
                .text('Payment Preview');
        }
    }
    /*
  NAME  : DownPaymentConfiguration
  DESC  : Fetches and configures the down payment details for a specific college program and enrollment semester. It updates the UI based on the down payment status and configuration.
  PARAMS: collegeProgramId,enrollSemesterId
  OUTPUT: NA
*/
    var DownPaymentConfiguration = async function (collegeProgramId, enrollSemesterId) {
        let data = await $.ajax({
            url: "/Enlistment/GetDownPaymentDetails/",
            type: 'post',
            data: { collegeProgramId: collegeProgramId, enrollSemesterId: enrollSemesterId, academicSessionId: $("#hdfAcademicSessionId").val() }
        });
        //async: false,
        //success: function (data) {

        $('#DownPaymentAmount').text('0');
        $('#SubsidizedAmount').text('0');
        $('#ProcessingAmount').text('0');
        $('#ProcessingSubsidizedAmount').text('0');
        $('#DownPaymentTotalAmount').text('0');

        downPaymentStatus = data.PAID_STATUS;
        DownPayCheck = data.PAID_STATUS;
        if (downPaymentStatus == 1) {
            $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
            $("#spnDownPayStaus").removeClass("d-none"); $("#spnOnlinePayementSataus").addClass("d-none");
            $("#divDownPayStatus").addClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
        }
        else if (downPaymentStatus == 2) {
            $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
            $("#spnOnlinePayementSataus").removeClass("d-none"); $("#spnDownPayStaus").addClass("d-none");
            $("#divDownPayStatus").addClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
        }
        else if (downPaymentStatus == 3) {
            $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").removeClass("hide");
            $("#spnDownPayStaus").addClass("d-none"); $("#spnOnlinePayementSataus").removeClass("d-none");
            $("#divDownPayStatus").removeClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
        }
        else if (downPaymentStatus == 5) {
            demandAmount = 0;
            $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").hide(); $("#spnPayementExamptSataus").removeClass("d-none");
            return false;
        }
        else {
            $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").removeClass("hide");
            $("#spnDownPayStaus").addClass("d-none"); $("#spnOnlinePayementSataus").addClass("d-none");
            $("#divDownPayStatus").removeClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
        }
        if (data.CONFIGURE_STATUS == 0) {
            iziToast.warning({ message: 'Down-payment is not yet available for you or payment type tagging is not done, please tag a payment type to proceed !' });
            $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#btnAdd,#btnClose").addClass("hide");
            if (downPaymentEventId == 1) {
                $('a[href="#STEP1"]').tab('show');
            }
            return false;
        }
        else {
            if (downPaymentEventId == 1) {
                $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").show();
            } else {
                $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
            }
            $("#btnAdd,#btnClose").removeClass("hide");
            if (downPaymentEventId == 1) {
                $('#DownPaymentAmount').text(data.DOWN_PAYMENT_AMOUNT);
                $('#SubsidizedAmount').text(data.FLEXIBLE_AMOUNT);
                $('#ProcessingAmount').text('0');
                $('#ProcessingSubsidizedAmount').text('0');
                $('#DownPaymentTotalAmount').text(data.FLEXIBLE_AMOUNT);
            }
            demandAmount = data.FLEXIBLE_AMOUNT;
            academicYearId = data.ACADEMIC_YEAR_ID;
            receiptTypeId = data.RECEIPT_TYPE_ID;
            feeheadId = data.FEESHEAD_ID;
            mstCurrencyId = data.MST_CURRENCY_ID;
            demandpgId = data.DEMANDPG_ID;
            if (downPaymentEventId == 1) {
                $("#Payatcampuslable").html(demandAmount);
                $("#PayatBanklable").html(demandAmount);
                $("#Onlinelable").html(demandAmount);
                $("#hdnPayTotalAmount").val(demandAmount);
                await GetPaymentModeConfiguration();
                //GetPaymentModeConfigPayment(); GetDropDownForBanks(); GetDropDownForPaymentGateway();
            }
        }
    }

    async function BindStudentPersonalDetails(academicSessionId) {
        try {
            let data = await $.ajax({
                url: "/Enlistment_V2/GetStudentPersonalDetailsForEnlistment/",
                type: 'post',
                data: { academicSessionId: academicSessionId }
            });
            if (data.length > 0) {
                IsDemandGenerated = data[0].IS_DEMAND_GENERATED;
                $('#School').text(data[0].COLLEGE_NAME);
                $('#Program').text(data[0].PROGRAM_TITLE);
                $('#Curriculum').text(data[0].CURRICULUM_NAME);
                $('#Campus').text(data[0].CAMPUSNAME);
                $('#LearmingModality').text(data[0].MODALITY_NAME);
                $('#StudentType').text(data[0].ADMISSION_TYPE_NAME);
                $('#PaymentType').text(data[0].PAYMENT_TYPE_NAME);
                $('#Sname').text(data[0].STUDENT_FULL_NAME);
                $('#SId').text(data[0].STUDENT_INPUT_ID);
                $('#SpnLearningModality').text(data[0].MODALITY_NAME);
                $('#SpnProvisionalSemester').text(data[0].SEMESTER_NAME);
                $('#SpnCampusName').text(data[0].CAMPUSNAME);

                $('#studentName').text(data[0].STUDENT_FULL_NAME);
                $('#program').text(data[0].PROGRAM_TITLE);
                $('#semester').text(data[0].SEMESTER_NAME);
                $('#studentID').text(data[0].STUDENT_INPUT_ID);
            }
        } catch (error) {
            console.error(error);
        }
    }
    /*
           NAME  :GetAllDropDown 
           DESC  :Get drop down details from binding
           PARAMS:STUDENT_ID,ACD_USER_ID,INSTITUTE_CREATION_ID
           OUTPUT:CAMPUSNO,CAMPUSNAME,COLLEGE_ID,COLLEGE_NAME,LEARNING_MODALITY_ID,MODALITY_NAME,COLLEGE_PROGRAM_ID,ENROLLMENT_SEMESTER_ID,SEMESTER_NAME
       */
    var GetAllDropDown = async function () {
        showFullPageLoader('Loading Details', 'Fetching your personal data...');
        try {
            let data = await $.ajax({
                url: "/Enlistment_V2/GetAllDropDown/",
                type: 'post'
            });
            //async: false,

            if (data['StudentCurrentDetail'].length > 0) {
                IsGenerateDemandRuntime = data['StudentCurrentDetail'][0].IS_GENERATE_DEMAND_RUNTIME;
                IsDemandGenerated = data['StudentCurrentDetail'][0].IS_DEMAND_GENERATED;

                if (data['StudentCurrentDetail'][0].IS_MULTIPLE_ALLOW == 1) {
                    if (data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID == 2 || data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID == 3) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                        $('#statusEnlistment').empty();
                        $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                        $("#hdfAcademicSessionId").val(data['StudentCurrentDetail'][0].ACADEMIC_SESSION_ID);
                        IsReportType = data['StudentCurrentDetail'][0].REPORT_TYPE;
                        IsReportName = data['StudentCurrentDetail'][0].REPORT_NAME;
                        await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());
                    } else if (data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID == 1 && data['StudentCurrentDetail'][0].IS_ENLISTMENT_LOCK == 4) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                        $('#statusEnlistment').empty();
                        $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                        $("#hdfAcademicSessionId").val(data['StudentCurrentDetail'][0].ACADEMIC_SESSION_ID);
                        IsReportType = data['StudentCurrentDetail'][0].REPORT_TYPE;
                        IsReportName = data['StudentCurrentDetail'][0].REPORT_NAME;
                        await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());
                    } else {
                        IsDisabledTab = 0;
                        $('a[href="#STEP1"]').prop('disabled', false);
                        $('a[href="#STEP2"]').prop('disabled', false);
                        $('#statusEnlistment').empty();
                        $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                        await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());
                    }
                }
                else {
                    if (data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID > 0) {
                        IsDisabledTab = 1;
                        $('a[href="#STEP3"]').tab('show');
                        $('a[href="#STEP1"]').prop('disabled', true);
                        $('a[href="#STEP2"]').prop('disabled', true);
                        $('#statusEnlistment').empty();
                        $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                        $("#hdfAcademicSessionId").val(data['StudentCurrentDetail'][0].ACADEMIC_SESSION_ID);
                        IsReportType = data['StudentCurrentDetail'][0].REPORT_TYPE;
                        IsReportName = data['StudentCurrentDetail'][0].REPORT_NAME;
                        await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());
                    } else {
                        IsDisabledTab = 0;
                        $('a[href="#STEP1"]').prop('disabled', false);
                        $('a[href="#STEP2"]').prop('disabled', false);
                        $('#statusEnlistment').empty();
                        $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                        await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());
                    }
                }
                const tbody = $('#tblRegisteredCourses tbody');

                if (data.RegisteredCourses && data.RegisteredCourses.length > 0) {

                    const rows = data.RegisteredCourses.map(item => `
        <tr>
            <td>${item.COURSE_CODE}</td>
            <td>${item.COURSE_NAME}</td>
            <td>${item.COURSE_TYPE_NAME}</td>
            <td>${item.CREDITS}</td>
            <td>${item.SECTION_NAME}</td>
            <td>${item.OVERALL_SCHEDULE}</td>
        </tr>
    `).join('');

                    tbody.html(rows);
                }
                else {

                    tbody.html(`
        <tr>
            <td colspan="5" class="text-center">
                No records found.
            </td>
        </tr>
    `);
                }
            }

            $("#divMainPanel").removeClass("d-none"); $("#divAlertMessage").addClass("d-none"); $("#divStudentHoldButton").addClass("d-none");
            enlistmentRuleConfig = data['EnlistmentRuleConfiguration'];
            ProgramId = data['StudentCurrentDetail'][0].COLLEGE_PROGRAM_ID;
            SemesterId = data['StudentCurrentDetail'][0].ENROLLMENT_SEMESTER_ID;
            if (IsDisabledTab == 0) {
                if (data['EnlistmentRuleConfiguration'].length == 0) {
                    $("#divActivityMessage").html("Enlistment Activity is currently not available !");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['StudentCurrentDetail'][0].CURRICULUM_CREATION_ID == 0) {
                    $("#divActivityMessage").html("Unable to load details, Curriculum is not yet tagged for you !");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['EnlistmentRuleConfiguration'][0].IS_PROFILE_COMPLETE == 0) {
                    $("#divActivityMessage").html("Your profile is incomplete. Please complete your profile before proceeding with enlistment !");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['MultipleAttemptConfig'][0].IS_VALID_STUDENT_STATUS == 0) {
                    $("#divActivityMessage").html("You are not eligible for enlistment due to your current student status. Kindly contact institute authorities !");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['EnlistmentRuleConfiguration'][0].IS_HOSTEL_APPLICABLE == 0) {
                    $("#divActivityMessage").html("Approval of your Hostel/Cafeteria application is required before enlistment !");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['EnlistmentRuleConfiguration'][0].FULL_WITHDRAW == 1) {
                    $("#divActivityMessage").html("Enlistment activity is currently unavailable due to registration withdrawal for the ongoing academic session.");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['EnlistmentRuleConfiguration'][0].IS_STUDENT_HOLD == 1) {

                    let holdDetails = data?.EnlistmentRuleConfiguration?.[0]?.STUDENT_HOLD_DETAILS || '';

                    $("#divActivityMessage").html("A deficiency has been tagged to your account. You are not allowed to proceed with enlistment. Kindly visit institute authorities for more details !" + (holdDetails ? '<br><br>' + holdDetails : ''));
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").removeClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                else if (data['RetakeStatus'].length > 0) {
                    if (data['RetakeStatus'][0].TOTAL_RETAKE_COUNT == 1) {
                        $("#divActivityMessage").html("Retake limit reached. You are not eligible for enlistment. Please contact the administrator for assistance.");
                        $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                        $("#divStudentHoldButton").addClass("d-none");
                        //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                        $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                        $('#btnAdd,#btnClose').addClass("hide");
                        $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                        $("#divEnlistmentType").addClass("d-none");
                        return false;
                    }
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_OUTSTANDING_APPLICABLE == 0) {
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", false);
                    $('#btnAdd,#btnClose').removeClass("hide");
                    $("input[name='EnrollmentOption']").prop("disabled", false);
                    $("#divEnlistmentType").removeClass("d-none");
                }
                else if (data['OutstandingStatus'].length > 0) {
                    if (data['OutstandingStatus'][0].OUTSTANDING_STATUS == 1) {
                        if (data['OutstandingStatus'][0].PROMISSORY_APPROVAL_STATUS == 0) {
                            $("#divActivityMessage").html("Enlistment Activity is currently not available for you due to an outstanding balance !");
                            $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                            $("#divStudentHoldButton").addClass("d-none");
                            //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                            $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                            $('#btnAdd,#btnClose').addClass("hide");
                            $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                            $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                            $("#divEnlistmentType").addClass("d-none");
                            return false;
                        }
                    }
                }
                else {
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", false);
                    $('#btnAdd,#btnClose').removeClass("hide");
                    $("input[name='EnrollmentOption']").prop("disabled", false);
                    $("#divEnlistmentType").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].DEGREE_CREDIT_EXISTS == 0 && data['EnlistmentRuleConfiguration'][0].USE_CURRICULUM_CREDITS == 1) {
                    $("#divActivityMessage").html("Enlistment activity is currently unavailable as the degree credit has not been defined.");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_COMPULSORY_TRANSFEREE == 1 && data['EnlistmentRuleConfiguration'][0].IS_FINAL_APPROVED != 1) {
                    $("#divActivityMessage").html("Transferee advising is mandatory. Enlistment can only be done after advising has been completed.");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_COURSE_CREDITING == 0) {
                    $("#divActivityMessage").html("Course crediting is mandatory. Enlistment can only be done after course crediting has been completed.");
                    $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                    $("#divStudentHoldButton").addClass("d-none");
                    //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                    $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                    $('#btnAdd,#btnClose').addClass("hide");
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                    $("#divEnlistmentType").addClass("d-none");
                    return false;
                }

                $.each(data.MultipleAttemptConfig, function (index, row) {
                    if (row.FEES_TYPE_ID == 1 && row.IS_STANDARD_FEE_DEFINE != 1) {
                        $("#divActivityMessage").html("The standard fee has not been defined.");
                        $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                        $("#divStudentHoldButton").addClass("d-none");
                        //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                        $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                        $('#btnAdd,#btnClose').addClass("hide");
                        $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                        $("#divEnlistmentType").addClass("d-none");
                        return false;
                    }
                    else if (row.FEES_TYPE_ID == 2 && row.IS_UNIT_FEE_CONFIGURE != 1) {
                        $("#divActivityMessage").html("The unit fee has not been defined.");
                        $("#divMainPanel").addClass("d-none"); $("#divAlertMessage").removeClass("d-none");
                        $("#divStudentHoldButton").addClass("d-none");
                        //iziToast.warning({ message: 'Enlistment Activity is currently not available !' });
                        $('#DivBindCourseList,#EnlistmentStatus').prop("disabled", true);
                        $('#btnAdd,#btnClose').addClass("hide");
                        $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide");
                        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide(); $("#divDownPayStatus").addClass("d-none");
                        $("#divEnlistmentType").addClass("d-none");
                        return false;
                    }
                });

                $("#pBindinstruction").empty();

                if (data.Instruction && data.Instruction.length > 0) {
                    $("#divShowInstruction").removeClass("d-none hide");
                    $("#pBindinstruction").html(decodeHtmlEntities(data.Instruction[0].INSTRUCTIONS));
                } else {
                    $("#divShowInstruction").addClass("d-none");
                    $("#pBindinstruction").empty();
                }

                $("#divPrivacyPolicy").empty();
                if (data.FinalConfirmInstruction && data.FinalConfirmInstruction.length > 0) {
                    FinalConfirmInstruction = 1;
                    $("#divPrivacyPolicy").html(decodeHtmlEntities(data.FinalConfirmInstruction[0].INSTRUCTIONS));
                } else {
                    FinalConfirmInstruction = 0;
                }

                $("#divBindPaymentPreviewNote").empty();
                const cfg = data.MultipleAttemptConfig?.[0];
                if (cfg) {
                    const scheduleHidden = cfg.IS_HIDE_SCHEDULE_PREVIEW;
                    const paymentHidden = cfg.IS_HIDE_PAYMENT_PREVIEW;
                    const paymentpreviewHidden = !cfg.IS_ENABLE_PAYMENT_PREVIEW;

                    $("#btnSchedule").toggleClass("d-none", scheduleHidden);
                    $("#btnPaymentPreview").toggleClass("d-none", paymentHidden);
                    $("#divPaymentPreviewNote").toggleClass("d-none", paymentpreviewHidden);
                    $("#divBindPaymentPreviewNote").html(decodeHtmlEntities(cfg.ENABLE_PAYMENT_PREVIEW_NOTE));
                } else {
                    $("#btnSchedule").toggleClass("d-none");
                    $("#btnPaymentPreview").toggleClass("d-none");
                    $("#divPaymentPreviewNote").toggleClass("d-none");
                }

                enrollmentMethod = data['EnlistmentRuleConfiguration'][0].ENLISTMENT_METHOD;
                $('input[name="EnrollmentOption"][value="' + enrollmentMethod + '"]').prop('checked', true);
                $("#hdfAcademicSessionId").val(data['EnlistmentRuleConfiguration'][0].ACADEMIC_SESSION_ID);
                $("#hdfRuleAllocationId").val(data['EnlistmentRuleConfiguration'][0].ENLISTMENT_RULE_ALLOCATION_ID);
                $("#hdfEnlistmentRuleId").val(data['EnlistmentRuleConfiguration'][0].ENLISTMENT_RULE_ID);
                minimumCredits = data['EnlistmentRuleConfiguration'][0].MIN_CREDIT;
                maximumCredits = (Number(data['EnlistmentRuleConfiguration'][0].MAX_CREDIT) + Number(data['EnlistmentRuleConfiguration'][0].MAX_CREDIT_CAN_ENROLL));
                isDownPayment = data['EnlistmentRuleConfiguration'][0].IS_DOWN_PAYMENT;
                studyLevelId = data['EnlistmentRuleConfiguration'][0].STUDY_LEVEL_ID;
                intakeCreationId = data['EnlistmentRuleConfiguration'][0].INTAKE_CREATION_ID;
                downPaymentEventId = data['EnlistmentRuleConfiguration'][0].MST_DOWN_PAYMENT_EVENT_ID;
                classCommenceDate = data['EnlistmentRuleConfiguration'][0].CLASS_COMMENCEMENT_DATE;
                IsSlotActive = data['EnlistmentRuleConfiguration'][0].IS_SLOT_ACTIVE;
                LateFeeReceiptId = data['EnlistmentRuleConfiguration'][0].RECEIPT_TYPE_ID;
                LateFeeFeeheadId = data['EnlistmentRuleConfiguration'][0].FEESHEAD_ID;
                Is_Late_Fee = data['EnlistmentRuleConfiguration'][0].IS_LATE_FEE;
                Late_Fee_Amount = data['EnlistmentRuleConfiguration'][0].TOTAL_LATE_FEE;
                academicYearId = data['EnlistmentRuleConfiguration'][0].ACADEMIC_YEAR_ID;
                mstCurrencyId = data['EnlistmentRuleConfiguration'][0].MST_CURRENCY_ID;
                LateFeeDemandPg = data['EnlistmentRuleConfiguration'][0].DEMANDPG_ID;
                IsReportType = data['StudentCurrentDetail'][0].REPORT_TYPE;
                IsReportName = data['StudentCurrentDetail'][0].REPORT_NAME;
                IsAllowMultiAttempt = data['EnlistmentRuleConfiguration'][0].IS_ALLOW_MULTIPLE_ATTEMPT;
                IsAllowMultiRestriction = data['EnlistmentRuleConfiguration'][0].LOCKING_EVENT_ID;
                IsEnlistmentLock = data['EnlistmentRuleConfiguration'][0].IS_ENLISTMENT_LOCK;
                IsFinalConfimShow = data['EnlistmentRuleConfiguration'][0].IS_ENLISTMENT_FINAL_CONFIRM;
                StdApprovalStatus = data['EnlistmentRuleConfiguration'][0].STUDENT_ENLIST_STATUS;
                IsShowSectionRemark = data['EnlistmentRuleConfiguration'][0].IS_SHOW_SECTION_REMARK;
                IsGenerateDemandRuntime = data['EnlistmentRuleConfiguration'][0].IS_GENERATE_DEMAND_RUNTIME;

                if (IsSlotActive == 1) {
                    $("#divSlot").removeClass("d-none");
                    RenderDropDown($('#ddlTimeSlot'), data['TimeSlotDrp'], 'SLOT_ID', 'SLOT_NAME');
                    $('#ddlTimeSlot').val(data['EnlistmentRuleConfiguration'][0].SLOT_ID).select2();
                    $("#supSlot").html(" * ");
                } else {
                    $("#divSlot").addClass("d-none");
                    $('#ddlTimeSlot option:not(:first)').remove();
                    $('#ddlTimeSlot').val(0).select2();
                    $("#supSlot").html("");
                }
                slotId = $('#ddlTimeSlot').val();

                if (data['EnlistmentRuleConfiguration'][0].MAX_CREDIT_CAN_ENROLL == 0) {
                    $("#spnCreditLimit").html(data['EnlistmentRuleConfiguration'][0].MAX_CREDIT);
                    $("#divOverloadCredit").addClass("d-none");
                } else {
                    $("#spnCreditLimit").html(data['EnlistmentRuleConfiguration'][0].MAX_CREDIT);
                    $("#spnOverloadCreditLimit").html(data['EnlistmentRuleConfiguration'][0].MAX_CREDIT_CAN_ENROLL);
                    $("#divOverloadCredit").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_BLOCK_SECTION == 0)
                    $("#divBlockSection").hide();
                else
                    $("#divBlockSection").show();
                if (data['EnlistmentRuleConfiguration'][0].IS_OPEN_SECTION == 0)
                    $("#divOpenSection").hide();
                else
                    $("#divOpenSection").show();
                if (data['EnlistmentRuleConfiguration'][0].IS_FIXED_SECTION == 0)
                    $("#divFixedSection").hide();
                else
                    $("#divFixedSection").show();

                if (data['EnlistmentRuleConfiguration'][0].IS_CORE == 0) {
                    $("#tblRegularCourses").addClass("d-none");
                    $("#lblCore").addClass("d-none");
                }
                else {
                    $("#tblRegularCourses").removeClass("d-none");
                    $("#lblCore").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_ELECTIVE == 0) {
                    $("#tblElectiveCourses").addClass("d-none");
                    $("#lblElective").addClass("d-none");
                }
                else {
                    $("#tblElectiveCourses").removeClass("d-none");
                    $("#lblElective").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_GLOBAL_ELECTIVE == 0) {
                    $("#tblGlobalCourses").addClass("d-none");
                    $("#lblglobalElective").addClass("d-none");
                }
                else {
                    $("#tblGlobalCourses").removeClass("d-none");
                    $("#lblglobalElective").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].IS_RESTUDY == 0) {
                    $("#tblRestudyCourses").addClass("d-none");
                    $("#lblRestudy").addClass("d-none");
                }
                else {
                    $("#tblRestudyCourses").removeClass("d-none");
                    $("#lblRestudy").removeClass("d-none");
                }
                if (data['EnlistmentRuleConfiguration'][0].NOT_STUDIED_COURSES == 0) {
                    $("#tblNotEnlisted").addClass("d-none");
                    $("#lblNotEnlisted").addClass("d-none");
                }
                else {
                    $("#tblNotEnlisted").removeClass("d-none");
                    $("#lblNotEnlisted").removeClass("d-none");
                }

                //RenderDropDown($('#ddlLearningModality'), data['LearningModlityDrp'], 'LEARNING_MODALITY_ID', 'MODALITY_NAME');
                //$("#ddlLearningModality").val(data['StudentCurrentDetail'][0].LEARNING_MODALITY_ID).prop("disabled", true);
                //RenderDropDown($('#ddlCampus'), data['CampusDrp'].filter(x => x.CAMPUSNO == data['StudentCurrentDetail'][0].CAMPUSNO), 'CAMPUSNO', 'CAMPUSNAME');
                //$("#ddlCampus").val(data['StudentCurrentDetail'][0].CAMPUSNO).prop("disabled", true);
                //RenderDropDown($('#ddlProvisionalSemester'), data['EnrollmentSemesterDrp'], 'ENROLLMENT_SEMESTER_ID', 'SEMESTER_NAME');
                //$("#ddlProvisionalSemester").val(data['StudentCurrentDetail'][0].ENROLLMENT_SEMESTER_ID).prop("disabled", true);

                await BindStudentPersonalDetails($("#hdfAcademicSessionId").val());

                StudentDetails = data;

                academicSessionId = data['EnlistmentRuleConfiguration'][0].ACADEMIC_SESSION_ID;
                curriculumCreationId = data['StudentCurrentDetail'][0].CURRICULUM_CREATION_ID;
                enrollmentSemesterId = data['StudentCurrentDetail'][0].ENROLLMENT_SEMESTER_ID;
                campusNo = data['StudentCurrentDetail'][0].CAMPUSNO;
                studentId = data['StudentCurrentDetail'][0].STUDENT_ID;
                collegeProgramid = data['StudentCurrentDetail'][0].COLLEGE_PROGRAM_ID
                $('#statusEnlistment').empty();
                $('#statusEnlistment').append(EnlistmentStatusFormatter(data['StudentCurrentDetail'][0].ENLISTMENT_APPROVAL_STATUS_ID));
                Enliststatus = data['EnlistmentRuleConfiguration'][0].STUDENT_ENLIST_STATUS;

                if (data['EnlistmentRuleConfiguration'][0].IS_DOWN_PAYMENT == 0) {
                    $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                }
                else {
                    if (data['EnlistmentRuleConfiguration'][0].MST_DOWN_PAYMENT_EVENT_ID == 2) {
                        $("#divDownPaymentConfig").hide(); $("#divDownPaymentApply").hide();
                        await DownPaymentConfiguration(data['StudentCurrentDetail'][0].COLLEGE_PROGRAM_ID, data['StudentCurrentDetail'][0].ENROLLMENT_SEMESTER_ID)
                        $("#spnDownPayStaus").addClass("d-none"); $("#spnOnlinePayementSataus").addClass("d-none");
                    } else {
                        $("#divDownPaymentConfig").show(); $("#divDownPaymentApply").show();
                        await DownPaymentConfiguration(data['StudentCurrentDetail'][0].COLLEGE_PROGRAM_ID, data['StudentCurrentDetail'][0].ENROLLMENT_SEMESTER_ID)
                    }
                }

                var providedDate = new Date(classCommenceDate);
                var dayOfWeek = providedDate.getDay();
                var diff = providedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust when day is Sunday
                var weekStartDate = new Date(providedDate.setDate(diff));
                formattedStartDate = `${weekStartDate.getMonth() + 1}/${weekStartDate.getDate()}/${weekStartDate.getFullYear()}`;
                CurrentCommesmentDate = formattedStartDate;
                if (data['EnlistmentRuleConfiguration'][0].STUDENT_ENLIST_STATUS > 0) {
                    $('#btnAdd').hide();
                    $('#btnEnlistment').hide();
                    $('#btnEnlistmentClose').hide();
                    $('#btnClose').hide();
                    $("input[name='EnrollmentOption']").prop("disabled", true);
                    $("#ddlTimeSlot").prop("disabled", true);
                    $("#btnSubmitPayAtCampus,#btnSubmitPayAtPaymentCenter,#btnPayNow").addClass("hide"); $("#divDownPayStatus").addClass("d-none");
                } else {
                    $('#btnAdd').show();
                    $('#btnEnlistment').show();
                    $('#btnEnlistmentClose').show();
                    $('#btnClose').show();
                    $("input[name='EnrollmentOption']").prop("disabled", false);
                    $("#ddlTimeSlot").prop("disabled", false);
                }
                $("#divEnlistmentMethodDetails").empty();
                $("#divEnlistmentMethodDetails").append(data['ENROLLMENT_DETAIL'][0].ENROLLMENT_DETAIL);
                //await GetMinorMajorStatus(collegeProgramid, enrollmentSemesterId);
            }

        } catch (error) {
            console.error(error);
        } finally {
            hideFullPageLoader();
        }
    };
    /*
NAME  :GetMinorMajorStatus
DESC  :Get minor major demand details
PARAMS:collegeProgramId,enrollSemesterId,StudentId
OUTPUT:return demand details
*/
    async function GetMinorMajorStatus(collegeProgramId, enrollSemesterId) {
        var formData = { collegeProgramId: collegeProgramId, enrollSemesterId: enrollSemesterId };
        const data = await $.ajax({
            url: "/Enlistment/GetMinorMajorStatus/",
            type: "POST",
            data: formData
        });
        ////async: false,
        //success: function (data) {
        MinorMajorDemandPg = data.DEMANDPG_ID;
        return data;
        //}

    }

    const grids = [
        { tableId: '#tblRegularCourses', listName: 'CourseDetails' },
        { tableId: '#tblElectiveCourses', listName: 'ElectiveCourseDetails' },
        { tableId: '#tblGlobalCourses', listName: 'GlobelElectiveCourseDetails' },
        { tableId: '#tblRestudyCourses', listName: 'GetRestudyCourseDetails' },
        { tableId: '#tblMinorMajorCourses', listName: 'GetMinorMajorCourseDetails' },
        { tableId: '#tblSpecialCourses', listName: 'SpecialCourseDetails' },
        { tableId: '#tblNotEnlisted', listName: 'NotEnlistedCourseDetails' }
    ];

    const courseLookup = {}; // courseId -> { course, coReqIds[], isCoReqFor:Set, $inputs }
    let suppressChange = false;

    // Helper to always get latest inputs (cached + fallback)
    function getInputs(courseId) {
        const d = courseLookup[courseId];
        if (!d) return $();
        if (!d.$inputs || d.$inputs.length === 0) {
            d.$inputs = $(`.chkCourseOffer[value="${courseId}"]`);
        }
        return d.$inputs;
    }

    function buildCourseLookup() {
        Object.keys(courseLookup).forEach(k => delete courseLookup[k]);

        grids.forEach(g => {
            const list = (window.CourseDetailsList && CourseDetailsList[g.listName]) || [];
            list.forEach(c => {
                const id = String(c.COURSE_CREATION_ID);
                const coReqIds = c.CO_REQUISITE_COURSE_ID
                    ? c.CO_REQUISITE_COURSE_ID.split(',').map(s => s.trim()).filter(Boolean)
                    : [];

                if (!courseLookup[id]) {
                    courseLookup[id] = {
                        course: c,
                        coReqIds,
                        isCoReqFor: new Set(),
                        $inputs: $(`.chkCourseOffer[value="${id}"]`)
                    };
                } else {
                    courseLookup[id].coReqIds = [...new Set([...courseLookup[id].coReqIds, ...coReqIds])];
                }
            });
        });

        // Reverse mapping
        for (const id in courseLookup) {
            courseLookup[id].isCoReqFor = new Set();
        }
        for (const id in courseLookup) {
            for (const coId of courseLookup[id].coReqIds) {
                if (courseLookup[coId]) {
                    courseLookup[coId].isCoReqFor.add(id);
                }
            }
        }
        setTimeout(() => {
            suppressChange = false;
            $('.chkCourseOffer').each(function () {
                $(this).trigger('change');   // use trigger, not triggerHandler
            });
        }, 0);
    }

    function isCourseSelected(courseId) {
        const $el = getInputs(courseId);
        return $el.length > 0 && $el[0].checked;
    }

    function selectAndDisable(courseId) {
        const d = courseLookup[courseId];
        if (!d) return;

        const $el = getInputs(courseId);
        suppressChange = true;
        $el.each(function () {
            const $checkbox = $(this);
            const isMandatory = d.course.IS_MANDATORY == 1;
            const Isequi = $(this).closest('tr').find('input[type="checkbox"]').data('isequi');
            const IsSectionCapacityFull = SectionData["SectionDetails"].filter(x => x.COURSE_CREATION_ID == courseId);

            $checkbox.prop({
                checked: true,
                disabled: true,
                title: 'Co-requisite'
            });
            if (this.checked && Isequi == 1 && IsSectionCapacityFull.length == 0 && !isMandatory) {
                this.checked = false; this.disabled = false;
                $(this).closest('tr').addClass('Skip-mandatory');
                $(this).closest('tr').addClass('CheckEquiValidate');
            }
            const existingTitle = $checkbox.closest('tr').find('label').prop('title');
            $checkbox.closest('tr').find('label').prop('title', existingTitle || 'Co-requisite');
        }).closest('tr').addClass('co-req-locked');
        suppressChange = false;

        d.coReqIds.forEach(id => selectAndDisable(id));
    }

    function maybeUnselectAndEnable(courseId, originParentId) {
        const d = courseLookup[courseId];
        if (!d) return;

        const $el = getInputs(courseId);
        suppressChange = true;
        $el.each(function () {
            this.disabled = StudentRegistered == 1 || d.course.PRE_REQUISITE_STATUS == 1 || d.course.IS_MANDATORY == 1 || d.course.IS_LOCK_CORE_COURSES == 1;
            this.checked = d.course.IS_MANDATORY == 1 || d.course.IS_REGISTERED == 1 || (d.course.IS_LOCK_CORE_COURSES == 1 && d.course.PRE_REQUISITE_STATUS == 0) || (EnlistmentMethod == 1 && d.course.PRE_REQUISITE_STATUS == 0 && $(this).data("core") == 1);
            this.tooltip = "";
        }).closest('tr').removeClass('co-req-locked');
        $el.each(function () {
            const isMandatory = d.course.IS_MANDATORY == 1;
            const IsLockCourseSubjects = d.course.IS_LOCK_CORE_COURSES == 1;
            const IsPreRequisiteCourse = d.course.PRE_REQUISITE_STATUS == 1
            const Isequi = $(this).closest('tr').find('input[type="checkbox"]').data('isequi');
            const IsSectionCapacityFull = SectionData["SectionDetails"].filter(x => x.COURSE_CREATION_ID == courseId);

            if (this.checked && isMandatory && IsPreRequisiteCourse) {
                $(this).closest('tr').addClass('Skip-mandatory');
                this.checked = false;
            } else {
                $(this).closest('tr').removeClass('Skip-mandatory');
            }
            if (!this.checked && IsLockCourseSubjects) {
                $(this).closest('tr').addClass('Skip-LockCourse');
            } else {
                $(this).closest('tr').removeClass('Skip-LockCourse');
            }
            if (this.checked && Isequi == 1 && IsSectionCapacityFull.length == 0 && !isMandatory) {
                this.checked = false; this.disabled = false;
                $(this).closest('tr').addClass('Skip-mandatory');
                $(this).closest('tr').addClass('CheckEquiValidate');
            }
        });
        suppressChange = false;

        d.coReqIds.forEach(id => maybeUnselectAndEnable(id, courseId));
    }

    $(document).on('change', '.chkCourseOffer', function () {
        var CheckCourseArray = new Array();

        if (suppressChange) return;

        const courseId = String(this.value);
        const courseData = courseLookup[courseId];
        if (!courseData) return;

        const isChecked = this.checked;
        const courseCode = (courseData.course.COURSE_CODE || "").replace(/[^\x00-\x7F]/g, "");

        // Prerequisite block
        if (isChecked && courseData.course.PRE_REQUISITE_STATUS == 1 && courseData.course.IS_REGISTERED == 0) {
            if (courseData.course.IS_MANDATORY == 1 && courseData.course.IS_REGISTERED == 0) {
                $(this).closest('tr').addClass('Skip-mandatory');
            } else {
                $(this).closest('tr').removeClass('Skip-mandatory');
            }
            if (courseData.course.IS_LOCK_CORE_COURSES == 1) {
                $(this).closest('tr').addClass('Skip-LockCourse');
            } else {
                $(this).closest('tr').removeClass('Skip-LockCourse');
            }
            //maybeUnselectAndEnable(courseId, null);
            CheckCourseArray.forEach(id => maybeUnselectAndEnable(id, null));
            iziToast.warning({ message: `Cannot select ${courseCode} pre-requisite criteria not fulfilled` });
            suppressChange = true;
            this.checked = false;
            if (courseData.course.IS_MANDATORY == 1 && courseData.course.IS_REGISTERED == 1) {
                this.checked = true;
            }
            suppressChange = false;
            return;
        }

        // Handle co-requisites
        for (const id of courseData.coReqIds) {
            const coReqData = courseLookup[id];
            if (!coReqData) continue;

            const coCourseCode = (coReqData.course.COURSE_CODE || "").replace(/[^\x00-\x7F]/g, "");

            if (isChecked && coReqData.course.PRE_REQUISITE_STATUS == 1) {
                if (courseData.course.IS_MANDATORY == 1 || coReqData.course.IS_MANDATORY == 1) {
                    $(this).closest('tr').addClass('Skip-mandatory');
                } else {
                    $(this).closest('tr').removeClass('Skip-mandatory');
                }
                if (courseData.course.IS_LOCK_CORE_COURSES == 1) {
                    $(this).closest('tr').addClass('Skip-LockCourse');
                } else {
                    $(this).closest('tr').removeClass('Skip-LockCourse');
                }
                /*maybeUnselectAndEnable(id, courseId);*/
                var message = '';
                if ((courseData.course.IS_REGISTERED == 0 || coReqData.course.IS_REGISTERED == 0)) {
                    if (EnlistmentMethod == 1 && ShoWAlertOnBlockSection == 0) {
                        ShoWAlertOnBlockSection = 1;
                        iziToast.warning({
                            message:
                                (courseData.course.IS_MANDATORY === 1 || coReqData.course.IS_MANDATORY === 1)
                                    ? `${message || `Cannot select ${courseCode}: It is mandatory and co-requisite, but pre-requisite ${coCourseCode} is not fulfilled`}`
                                    : `Cannot select ${courseCode}: It is co-requisite, but pre-requisite ${coCourseCode} is not fulfilled`
                        });
                    } if (EnlistmentMethod != 1) {
                        ShoWAlertOnBlockSection = 0;
                        iziToast.warning({
                            message:
                                (courseData.course.IS_MANDATORY === 1 || coReqData.course.IS_MANDATORY === 1)
                                    ? `${message || `Cannot select ${courseCode}: It is mandatory and co-requisite, but pre-requisite ${coCourseCode} is not fulfilled`}`
                                    : `Cannot select ${courseCode}: It is co-requisite, but pre-requisite ${coCourseCode} is not fulfilled`
                        });
                    }
                }
                CheckCourseArray.forEach(id => maybeUnselectAndEnable(id, null));
                suppressChange = true;
                this.checked = false;
                if ((courseData.course.IS_MANDATORY == 1 || coReqData.course.IS_MANDATORY == 1) && (courseData.course.IS_REGISTERED == 1 || coReqData.course.IS_REGISTERED == 1)) {
                    this.checked = true;
                }
                suppressChange = false;
                return;
            }
            isChecked ? selectAndDisable(id) : maybeUnselectAndEnable(id, courseId);
            if (isChecked == true) {
                CheckCourseArray.push(id);
            }
        }
    });

    // Select All checkbox change handler
    $(document).on('change', '.chkAll, .chkAllE, .chkAllG, .chkAllR, .chkAllM, .chkAllS, .chkAllN', function () {
        $('.chkCourseOffer').each(function () {
            suppressChange = false;
            // Manually trigger the change event so your existing logic runs
            $(this).trigger('change');
        });
    });
    /*
         NAME  :GetSectionList
         DESC  :Get all offered section details from binding
         PARAMS:academicSessionId,STUDENT_ID,INSTITUTE_CREATION_ID
         OUTPUT:SectionDetails list,GetRestudySectionDetails list,CourseRegistrationDetails list,RestudyCourseRegistrationDetails list
     */
    async function GetSectionList(SectionCourselist) {
        let data = await $.ajax({
            url: "/Enlistment_V2/GetCourseWiseSectionData/",
            type: 'post',
            data: { CourseList: SectionCourselist, academicSessionId: $("#hdfAcademicSessionId").val() },
            dataType: "json"
            //async: false,
        });
        //success: function (data) {
        if (data["SectionDetails"].length > 0) {
            SectionData = data;
        } else if (data["SectionDetails"].length == 0) {
            data["SectionDetails"].push({
                SECTION_CREATION_ID: 0,
                SECTION_NAME: '',
                COURSE_CREATION_ID: 0,
                CORE_CROSS: 0
            });
            SectionData = data;
        } else {
            return false;
        }
        //}

    }
    // Full Page Loader Functions
    window.showFullPageLoader = (title = 'Loading', subtitle = 'Please wait...') => {
        document.body.classList.add('loader-active');

        const loaderHTML = `
        <div class="full-page-loader">
            <div class="full-page-loader-content">
                <div class="spinner-border text-success full-page-loader-spinner" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <h5 class="full-page-loader-title">${title}</h5>
                <p class="full-page-loader-subtitle">${subtitle}</p>
            </div>
        </div>
    `;

        $('#MyLoader').html(loaderHTML).show();
    };

    window.hideFullPageLoader = () => {
        $('#MyLoader').fadeOut(300, function () {
            $(this).empty();
            document.body.classList.remove('loader-active');
        });
    };
    /*
           NAME  :GetAllCourseSectionData
           DESC  :Get all offered course details from binding
           PARAMS:academicSessionId,STUDENT_ID,ruleAllocationId,enlistmentRuleId,ACD_USER_ID,INSTITUTE_CREATION_ID
           OUTPUT:CourseDetails list,ElectiveCourseDetails list,GlobelElectiveCourseDetails list,GetRestudyCourseDetails list,GetExemptedCourseDetails list,IS_EXAM_REGISTRATION,IS_AUTO_ADVISING,ENLISTMENT_METHOD,CURRICULUM_CREATION_ID,STUDENT_ENLIST_STATUS,SECTION_CREATION_ID,PAYMENT_TYPE_ID
       */
    var GetAllCourseSectionData = async function (academicSessionId, ruleAllocationId, enlistmentRuleId) {

        if (IsDisabledTab == 1) {
            return false;
        }
        if (AlreadyLoadData == 1) {
            return false;
        }
        showFullPageLoader('Loading Courses', 'Fetching your course data...');
        $('#lblCore').text("Core Courses");
        $('#lblElective').text("Elective Courses");
        $('#lblglobalElective').text("Global Elective Courses");
        $('#lblRestudy').text("Restudy/Retake Courses");
        $('#lblExempted').text("Credited Courses");
        $('#lblMinorMajor').text("Minor/Major/Specialization Courses");
        $('#lblSpecial').text("Special Offer Courses");
        $('#lblNotEnlisted').text("Not Enlisted Courses");
        $('#lblCore,#tblRegularCourses,#lblElective,#tblElectiveCourses,#lblglobalElective,#tblGlobalCourses,#lblRestudy,#tblRestudyCourses,#lblMinorMajor,#tblMinorMajorCourses,#lblSpecial,#tblSpecialCourses,#lblNotEnlisted,#tblNotEnlisted').addClass("hide");
        $("#configStep2Section").hide();
        try {
            let data = await $.ajax({
                url: "/Enlistment_V2/GetAllCourseSectionData/",
                type: 'post',
                //async: false,
                data: { academicSessionId: academicSessionId, ruleAllocationId: ruleAllocationId, enlistmentRuleId: enlistmentRuleId },
                dataType: "json"
            });
            AlreadyLoadData = 1;
            //success: function (data) {
            ShoWAlertOnBlockSection = 0;
            if (data.CURRICULUM_CREATION_ID == 0) {
                iziToast.warning({ message: 'Unable to load courses, Curriculum is not yet tagged for you !' });
                $('a[href="#STEP1"]').tab('show');
                $('#btnEnlistment,#btnSchedule,#btnPaymentPreview,#btnEnlistmentClose').hide();
                return false;
            }
            if (data.PAYMENT_TYPE_ID == 0) {
                iziToast.warning({ message: 'Unable to load courses, Payment type is not yet tagged for you !' });
                $('a[href="#STEP1"]').tab('show');
                $('#btnEnlistment,#btnSchedule,#btnPaymentPreview,#btnEnlistmentClose').hide();
                return false;
            }
            IsExamRegistration = data.IS_EXAM_REGISTRATION;
            Is_AutoAdvising = data.IS_AUTO_ADVISING;
            EnlistmentMethod = data.ENLISTMENT_METHOD;
            CourseDetailsList = data;
            PaymentTypeId = data.PAYMENT_TYPE_ID;

            var addClassName = '';
            //var DisabledOldSubject = 0;

            if (data.ENLISTMENT_METHOD == 0) {
                iziToast.warning({ message: 'Please Complete Step 1 First !' });
                $('a[href="#STEP1"]').tab('show');
                $('#btnEnlistment').hide();
                $('a[href="#STEP1"]').click();
                return false;
            }
            if (IsAllowMultiAttempt == 1 && DownPayCheck != 1 && IsAllowMultiRestriction == 2 && IsEnlistmentLock == 1) {
                DownPayCheck = 1;
            }

            if (data.STUDENT_ENLIST_STATUS > 0) {
                if (downPaymentEventId == 1 && StdApprovalStatus > 0 && IsAllowMultiAttempt == 1 && IsAllowMultiRestriction == 2 && FinalConfimSubmit == 0) {
                    StudentRegistered = 1;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').hide();
                    $("#btnEnlistmentClose").hide();
                }
                else if (downPaymentEventId == 2 && StdApprovalStatus > 0 && IsAllowMultiAttempt == 1
                    && IsAllowMultiRestriction == 2 && DownPayCheck != 1 && FinalConfimSubmit == 0) {
                    StudentRegistered = 0;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                } else if (downPaymentEventId == 0 && StdApprovalStatus > 0 && IsAllowMultiAttempt == 1
                    && IsAllowMultiRestriction == 2 && FinalConfimSubmit == 0) {
                    StudentRegistered = 1;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').hide();
                    $("#btnEnlistmentClose").hide();
                } else if (StdApprovalStatus > 0 && IsAllowMultiAttempt == 1 && IsAllowMultiRestriction == 1 && IsEnlistmentLock == 0 && FinalConfimSubmit == 0) {
                    StudentRegistered = 0;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                } else if (StdApprovalStatus > 0 && IsAllowMultiAttempt == 1 && IsAllowMultiRestriction == 4 && IsEnlistmentLock == 0 && FinalConfimSubmit == 0) {
                    StudentRegistered = 0;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                    $('#btnConfirmEnlistment').remove();
                    $('#btnEnlistment').after(IsFinalConfimShow);
                } else if (StdApprovalStatus > 0 && IsAllowMultiAttempt == 1 && IsAllowMultiRestriction == 3 && IsEnlistmentLock == 0 && FinalConfimSubmit == 0) {
                    StudentRegistered = 0;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                } else {
                    StudentRegistered = 1;
                    $('#btnAdd').hide();
                    $('#btnEnlistment').hide();
                    $("#btnEnlistmentClose").hide();
                    $('#btnConfirmEnlistment').remove();
                }
            }
            else {
                if (IsAllowMultiAttempt == 1 && IsAllowMultiRestriction == 4 && IsEnlistmentLock == 0) {
                    StudentRegistered = 0;
                    $('#btnAdd').show();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                    $('#btnConfirmEnlistment').remove();
                    $('#btnEnlistment').after(IsFinalConfimShow);
                } else {
                    $('#btnAdd').show();
                    $('#btnEnlistment').show();
                    $("#btnEnlistmentClose").show();
                }
            }
            if (EnlistmentMethod == 3) {
                $(".thEnlistmentMethod").prop("disabled", false); //$(".thEnlistmentMethod").show();
                $("#configStep2Section").hide();
            }
            else {
                $(".thEnlistmentMethod").prop("disabled", false); //$(".thEnlistmentMethod").show();
                $("#configStep2Section").hide();
            }
            if (StudentRegistered == 1) {
                $(".chkAll,.chkAllE,.chkAllG,.chkAllR,.chkAllM,.chkAllS,.chkAllN").prop('disabled', true);
            }
            else {
                $(".chkAll,.chkAllE,.chkAllG,.chkAllR,.chkAllM,.chkAllS,.chkAllN").prop('disabled', false);
            }
            var isSectionDisabled = EnlistmentMethod == 3 ? 'disabled' : '';

            $('#tblRegularCourses tbody').empty();
            if (data.CourseDetails.length > 0 && enlistmentRuleConfig[0].IS_CORE == 1) {
                $('#lblCore,#tblRegularCourses').removeClass("hide");
                $('#lblCore,#tblRegularCourses').removeClass("d-none");
            }
            else {
                $('#lblCore,#tblRegularCourses').addClass("hide");
            }
            var Precnt = 0;
            if (data.CourseDetails.length == 0 && data.ElectiveCourseDetails.length == 0 && data.GlobelElectiveCourseDetails.length == 0 && data.GetRestudyCourseDetails.length == 0 && data.GetMinorMajorCourseDetails.length == 0 && data.SpecialCourseDetails.length == 0 && data.NotEnlistedCourseDetails.length == 0) {
                iziToast.warning({ message: 'Course Not Offered' });
                $('#btnSchedule,#btnPaymentPreview,#btnEnlistment,#btnEnlistmentClose').addClass("hide");
                $('#btnConfirmEnlistment').remove();
                return false;
            }
            else {
                $('#btnSchedule,#btnPaymentPreview,#btnEnlistment,#btnEnlistmentClose').removeClass("hide");
            }
            let SectionScheduleData = [];
            const allCourses = [
                ...data.CourseDetails,
                ...data.ElectiveCourseDetails,
                ...data.GlobelElectiveCourseDetails,
                ...data.GetMinorMajorCourseDetails,
                ...data.GetRestudyCourseDetails,
                ...data.SpecialCourseDetails,
                ...data.NotEnlistedCourseDetails
            ];

            CourseFinalGridCheck = allCourses;

            ScheduleCourselist = allCourses.map(course => course.COURSE_CREATION_ID + 'T').join('');

            // Create a map of COURSE_CREATION_ID => GRID_TYPE
            const gridTypeMap = new Map();

            // Add cross-offer courses with their corresponding GRID_TYPEs
            data.GlobelElectiveCourseDetails.forEach(c => gridTypeMap.set(c.COURSE_CREATION_ID, 1));
            data.GetRestudyCourseDetails.forEach(c => gridTypeMap.set(c.COURSE_CREATION_ID, 2));
            data.GetMinorMajorCourseDetails.forEach(c => gridTypeMap.set(c.COURSE_CREATION_ID, 3));
            data.SpecialCourseDetails.forEach(c => gridTypeMap.set(c.COURSE_CREATION_ID, 4));
            data.NotEnlistedCourseDetails.forEach(c => gridTypeMap.set(c.COURSE_CREATION_ID, 5));

            // Add normal course details with GRID_TYPE = 0 if not already set
            [
                ...data.CourseDetails,
                ...data.ElectiveCourseDetails
            ].forEach(c => {
                if (!gridTypeMap.has(c.COURSE_CREATION_ID)) {
                    gridTypeMap.set(c.COURSE_CREATION_ID, 0);
                }
            });

            // Build final list
            const SectionCourselist = allCourses.map(course => {
                const gridType = gridTypeMap.get(course.COURSE_CREATION_ID) ?? 0;
                return {
                    COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                    CROSS_OFFER: gridType > 0 ? 1 : course.IS_ONE_WAY_TWO_WAY == 1 ? 1 : course.CROSS_OFFER,
                    GRID_TYPE: gridType
                };
            });

            await GetSectionList(SectionCourselist);

            if (typeof (SectionData) == 'undefined') {
                iziToast.warning({ message: 'Something went wrong !' });
                return false;
            }
            //ScheduleType = allCourses.map(course =>
            //    data.GetRestudyCourseDetails.includes(course)
            //        ? (course.CROSS_OFFER == 0 ? '2T' : course.CROSS_OFFER + 'T')
            //        : course.CROSS_OFFER + 'T'
            //).join('');
            //ScheduleType.push(allCourses
            //    .map(course => {
            //        if (data.GetRestudyCourseDetails.includes(course)) {
            //            return course.CROSS_OFFER === 0 ? '2' : course.CROSS_OFFER + '1';
            //        } else if (data.NotEnlistedCourseDetails.includes(course)) {
            //            return course.CROSS_OFFER === 0 ? '3' : course.CROSS_OFFER + '1';
            //        } else {
            //            return course.CROSS_OFFER + '1';
            //        }
            //    })
            //    .join(''));

            var startDate1 = moment(CurrentCommesmentDate);
            var endDate1 = moment(startDate1).endOf('isoWeek');

            var EnlistmentCourseScheduleArray = new Array();
            allCourses.forEach(course => {
                const EnlistmentCourseSchedule = {
                    COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                    SECTION_CREATION_ID: 0,
                    CAMPUSNO: campusNo
                };
                EnlistmentCourseScheduleArray.push(EnlistmentCourseSchedule);
            });
            //if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                let Scheduledata = await $.ajax({
                    url: "/Enlistment/GetSectionScheduleData/",
                    type: "POST",
                    dataType: "json",
                    //async: false,
                    data: {
                        STARTDATE: startDate1.format('YYYY-MM-DD'),
                        ENDDATE: endDate1.format('YYYY-MM-DD'),
                        ACADEMICSESSIONID: academicSessionId,
                        RULEALLOCATIONID: 0,
                        CAMPUSNO: campusNo,
                        enlistmentSchedule: EnlistmentCourseScheduleArray
                    }
                });
                //success: function (Scheduledata) {
                if (Scheduledata.length > 0) {
                    SectionScheduleData = Scheduledata;
                }
                //    },
                //    error: function (xhr, status, error) {

                //    }
                //});
            //}

            var OneWayArray = new Array();

            $.each(data.CourseDetails, function (index, item) {
                addClassName = 'thEnlistmentMethod';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = item.IS_LOCK_CORE_COURSES !== 0 ? 'disabled' : '';
                isCoreDisabled = isDisabled;
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0;
                var EquivalenceCourseName = '';
                var IsSkipLockCoreCourse = 0;

                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                else if (item.IS_LOCK_CORE_COURSES !== 0 && item.PRE_REQUISITE_STATUS == 0) {
                    isChecked = 'checked';
                    isDisabled = 'disabled';
                    tooltip = 'Lock Core Courses';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 3) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                else if (item.CROSS_OFFER == 0 && EnlistmentMethod == 3) {
                    isSectionDisabled = 'disabled';
                }
                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (EnlistmentMethod == 1 && StudentRegistered == 0 && item.PRE_REQUISITE_STATUS == 0 && StdApprovalStatus == 0) {
                    isChecked = 'checked';
                    $(".chkAll").prop('checked', true);
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }
                if (item.IS_ONE_WAY_TWO_WAY == 1 && StudentRegistered == 0) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.IS_LOCK_CORE_COURSES !== 0 && item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.PRE_REQUISITE_STATUS == 0 && item.IS_MANDATORY == 0) {
                    isDisabled = StudentRegistered == 0 ? '' : 'disabled';
                    isChecked = item.IS_REGISTERED == 0 ? '' : 'checked';
                    IsSkipLockCoreCourse = 0;
                }
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblRegularCourses tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                }
                else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkCourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-core="1" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-lockcore="${IsSkipLockCoreCourse == 0 ? 0 : item.IS_LOCK_CORE_COURSES}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkCourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value = "${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkCourseOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ``}</span>

                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                    ${eqIcon}
                   </div>
                 </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                 <td class="min-w-200"> 
                 <select class="form-control form-select AppendSelect ${addClassName}" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblRegularCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", item.CROSS_OFFER == 1 ? 0 : item.IS_ONE_WAY_TWO_WAY == 1 ? 0 : 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                /*                    $(".loader-area, .loader").fadeOut('slow');*/
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });

                /// Start MSCORE-30771 Add this first td as per condition
                //<i class="bi bi-arrow-left-right"
                //    data-bs-toggle="popover"
                //    title="Equivalent Courses"
                //    data-bs-html="true"
                //    data-bs-content="
                //      <ul class='mb-0 ps-3'>
                //        <li>Computer Science (CS101)</li>
                //        <li>Information Technology (IT102)</li>
                //        <li>Mechanical Engineering (ME103)</li>
                //        <li>Electrical Engineering (EE104)</li>
                //        <li>Civil Engineering (CE105)</li>
                //      </ul>">
                //</i>


                //const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                //popoverTriggerList.forEach(function (el) {
                //    new bootstrap.Popover(el, {
                //        trigger: 'hover', // show on hover
                //        placement: 'right', // optional: top, bottom, left, right
                //        html: true
                //    });
                //});

                //End MSCORE - 30771
            });
            //$('#tblRegularCourses').on('change', 'input[name=chkCourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["CourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["CourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblRegularCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblRegularCourses input[name=chkCourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["CourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        if (CourseDetailsList["CourseDetails"].find(x => x.COURSE_CREATION_ID == value).PRE_REQUISITE_STATUS == 0) {
            //            $(`#tblRegularCourses input[value=${value}]`).prop("checked", bool)
            //            $(`#tblRegularCourses input[value=${value}]`).prop("disabled", bool)
            //        }
            //    })
            //})
            const chkCAll = document.querySelectorAll('#tblRegularCourses' + ' .chkAll');
            chkCAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    // checkAllFormatter('.chkAll', 'input[name^=chkCourseOfferChlId]');
                    $('input[name^="chkCourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkCourseOfferChlId]").prop("checked"));
                })
            })

            $('#tblElectiveCourses tbody').empty();
            if (data.ElectiveCourseDetails.length > 0 && enlistmentRuleConfig[0].IS_ELECTIVE == 1) {
                $('#lblElective,#tblElectiveCourses').removeClass("hide");
                $('#lblElective,#tblElectiveCourses').removeClass("d-none");
            }
            else {
                $('#lblElective,#tblElectiveCourses').addClass("hide");
            }
            $.each(data.ElectiveCourseDetails, function (index, item) {
                addClassName = 'thEnlistmentMethod';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = ''; addClassName = '';
                }
                else if (item.CROSS_OFFER == 0 && EnlistmentMethod == 1) {
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 3) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                else if (item.CROSS_OFFER == 0 && EnlistmentMethod == 3) {
                    isSectionDisabled = 'disabled';
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }
                if (item.IS_ONE_WAY_TWO_WAY == 1 && StudentRegistered == 0) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                //if (item.IS_FLEXIBLE == 1 && item.PRE_REQUISITE_STATUS == 0) {
                //    isDisabled = 'disabled';
                //    isChecked = '';
                //    tooltip = 'Elective group selection limit reached'
                //}

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `<li>${c.IS_ONE_WAY_TWO_WAY_COURSE}</li>`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblElectiveCourses tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkECourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-elective="${item.IS_FLEXIBLE},${item.NO_OF_COURSES},${item.ELECTIVE_GROUP_ID},${item.ELECTIVE_GROUP_NAME},${item.MIN_NO_OF_COURSES}" data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkECourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value="${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkECourseOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                   ${eqIcon}
                   </div>
                   </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.ELECTIVE_GROUP_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                 <td> 
                 <select class="form-control form-select AppendSelect ${addClassName}" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblElectiveCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", item.CROSS_OFFER == 1 ? 0 : item.IS_ONE_WAY_TWO_WAY == 1 ? 0 : 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });
            //$('#tblElectiveCourses').on('change', 'input[name=chkECourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["ElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["ElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblElectiveCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblElectiveCourses input[name=chkECourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["ElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblElectiveCourses input[value=${value}]`).prop("checked", bool)
            //        $(`#tblElectiveCourses input[value=${value}]`).prop("disabled", bool)
            //    });
            //});
            const chkEAll = document.querySelectorAll('#tblElectiveCourses' + ' .chkAllE');
            chkEAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    //checkAllFormatter('.chkAll', 'input[name^=chkECourseOfferChlId]');
                    $('input[name^="chkECourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkECourseOfferChlId]").prop("checked"));
                })
            })

            $('#tblGlobalCourses tbody').empty();

            if (data.GlobelElectiveCourseDetails.length > 0 && enlistmentRuleConfig[0].IS_GLOBAL_ELECTIVE == 1) {
                $('#lblglobalElective,#tblGlobalCourses').removeClass("hide");
                $('#lblglobalElective,#tblGlobalCourses').removeClass("d-none");
            }
            else {
                $('#lblglobalElective,#tblGlobalCourses').addClass("hide");
            }
            $.each(data.GlobelElectiveCourseDetails, function (index, item) {
                addClassName = 'thEnlistmentMethod';
                var Id = index + 1;
                Precnt = Precnt + 1;
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = ''; var tooltip = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (EnlistmentMethod == 3) {
                    isSectionDisabled = ''; addClassName = '';
                }
                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = ''; addClassName = '';
                }
                else if (item.CROSS_OFFER == 0 && EnlistmentMethod == 1) {
                    isSectionDisabled = 'disabled';
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }
                if (item.IS_ONE_WAY_TWO_WAY == 1 && StudentRegistered == 0) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                //if (item.IS_FLEXIBLE == 1 && item.PRE_REQUISITE_STATUS == 0) {
                //    isDisabled = 'disabled';
                //    isChecked = '';
                //    tooltip = 'Global elective group selection limit reached'
                //}

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblGlobalCourses tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkGCourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-gelective="${item.IS_FLEXIBLE},${item.NO_OF_COURSES},${item.ELECTIVE_GROUP_ID},${item.ELECTIVE_GROUP_NAME},${item.MIN_NO_OF_COURSES}" data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkGCourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value="${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkGCourseOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                 ${eqIcon}
                   </div>
                 </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.ELECTIVE_GROUP_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                 <td>
                 <select class="form-control form-select AppendSelect ${addClassName}" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblGlobalCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                // $('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });
            //$('#tblGlobalCourses').on('change', 'input[name=chkGCourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["GlobelElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["GlobelElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblGlobalCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblGlobalCourses input[name=chkGCourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["GlobelElectiveCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblGlobalCourses input[value=${value}]`).prop("checked", bool)
            //        $(`#tblGlobalCourses input[value=${value}]`).prop("disabled", bool)
            //    })
            //})
            const chkGAll = document.querySelectorAll('#tblGlobalCourses' + ' .chkAllG');
            chkGAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    //checkAllFormatter('.chkAll', 'input[name^=chkGCourseOfferChlId]');
                    $('input[name^="chkGCourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkGCourseOfferChlId]").prop("checked"));
                })
            })
            $('#tblRestudyCourses tbody').empty();
            if (data.GetRestudyCourseDetails.length > 0 && enlistmentRuleConfig[0].IS_RESTUDY == 1) {
                $('#lblRestudy,#tblRestudyCourses').removeClass("hide");
                $('#lblRestudy,#tblRestudyCourses').removeClass("d-none");
            }
            else {
                $('#lblRestudy,#tblRestudyCourses').addClass("hide");
            }
            //var Precnt = 0;

            $.each(data.GetRestudyCourseDetails, function (index, item) {
                addClassName = ''; isSectionDisabled = '';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = ''; addClassName = '';
                }
                if (item.TOTAL_RETAKE_COUNT == 1 && item.IS_RETAKE == 1 && item.IS_PROGRAM_SHIFT == 1) {
                    isDisabled = 'disabled';
                    tooltip = 'Retake Limit Reached';
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblRestudyCourses tbody input[name='hdnRestudyCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkRestudyCourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkRestudyCourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value = "${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkRestudyCourseOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnRestudyCourseCreationId" name="hdnRestudyCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnRestudyEnrollmentSemesterId" name="hdnRestudyEnrollmentSemesterId" value="${item.ENROLLMENT_SEMESTER_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <input type="hidden" id="hdnRetakeOffer" name="hdnRetakeOffer" value="${item.IS_RETAKE}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                   <span class="text-warning ms-2">${item.IS_RETAKE == 1 ? '$' : ''}</span>
                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                ${eqIcon}
                   </div>
                 </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                 <td>
                 <select class="form-control form-select AppendSelect" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblRestudyCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnRestudyCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnRestudyCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnRestudyCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });
            //$('#tblRestudyCourses').on('change', 'input[name=chkRestudyCourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["GetRestudyCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["GetRestudyCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblRestudyCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblRestudyCourses input[name=chkRestudyCourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["GetRestudyCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblRestudyCourses input[value=${value}]`).prop("checked", bool)
            //        $(`#tblRestudyCourses input[value=${value}]`).prop("disabled", bool)
            //    })
            //})
            const chkRestudyCAll = document.querySelectorAll('#tblRestudyCourses' + ' .chkAllR');
            chkRestudyCAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    //checkAllFormatter('.chkAll', 'input[name^=chkRestudyCourseOfferChlId]');
                    $('input[name^="chkRestudyCourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkRestudyCourseOfferChlId]").prop("checked"));
                })
            })
            // minor major //
            $('#tblMinorMajorCourses tbody').empty();

            if (data.GetMinorMajorCourseDetails.length > 0) {
                $('#lblMinorMajor,#tblMinorMajorCourses').removeClass("hide");
                $('#lblMinorMajor,#tblMinorMajorCourses').removeClass("d-none");
            }
            else {
                $('#lblMinorMajor,#tblMinorMajorCourses').addClass("hide");
            }
            $.each(data.GetMinorMajorCourseDetails, function (index, item) {
                addClassName = ''; isSectionDisabled = '';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = '';
                    addClassName = '';
                }
                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblMinorMajorCourses tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkMinorMajorOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkMinorMajorOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value = "${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkMinorMajorOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnMinorMajorCredit" name="hdnMinorMajorCredit" value="${item.MINIMUM_CREDIT}" />
                   <input type="hidden" id="hdnSegmentId" name="hdnSegmentId" value="${item.MAJOR_MINOR_SEGMENT_ID}" />
                   <input type="hidden" id="hdnBucketId" name="hdnBucketId" value="${item.MAJOR_MINOR_CONFIGURATION_ID}" />
                   <input type="hidden" id="hdnReceiptTypeId" name="hdnReceiptTypeId" value="${item.RECEIPT_TYPE_ID}" />
                   <input type="hidden" id="hdnFeeHeadId" name="hdnFeeHeadId" value="${item.FEESHEAD_ID}" />
                   <input type="hidden" id="hdnAmount" name="hdnAmount" value="${item.AMOUNT}" />
                   <input type="hidden" id="hdnCurrencyId" name="hdnCurrencyId" value="${item.MST_CURRENCY_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <input type="hidden" id="hdnIsFeeApplicable" name="hdnIsFeeApplicable" value="${item.IS_PAYMENT_APPLICABLE}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                ${eqIcon} 
                   </div>
                 </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.MAJOR_MINOR_SEGMENT_NAME}</td>
                 <td>${item.BUCKET_TITLE}</td>
                 <td>${item.CREDITS}</td>                  
                 <td> 
                 <select class="form-control form-select AppendSelect ${addClassName}" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblMinorMajorCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });
            //$('#tblMinorMajorCourses').on('change', 'input[name=chkMinorMajorOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["GetMinorMajorCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["GetMinorMajorCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblMinorMajorCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblMinorMajorCourses input[name=chkMinorMajorOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["GetMinorMajorCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblMinorMajorCourses input[value=${value}]`).prop("checked", bool)
            //        $(`#tblMinorMajorCourses input[value=${value}]`).prop("disabled", bool)
            //    })
            //})
            const chkCMimorMajorAll = document.querySelectorAll('#tblMinorMajorCourses' + ' .chkAllM');
            chkCMimorMajorAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    // checkAllFormatter('.chkAll', 'input[name^=chkCourseOfferChlId]');
                    $('input[name^="chkMinorMajorOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkMinorMajorOfferChlId]").prop("checked"));
                })
            })
            $('#tblSpecialCourses tbody').empty();
            if (data.SpecialCourseDetails.length > 0) {
                $('#lblSpecial,#tblSpecialCourses').removeClass("hide");
                $('#lblSpecial,#tblSpecialCourses').removeClass("d-none");
            }
            else {
                $('#lblSpecial,#tblSpecialCourses').addClass("hide");
            }
            $.each(data.SpecialCourseDetails, function (index, item) {
                addClassName = ''; isSectionDisabled = '';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                //isCoreDisabled = isDisabled;
                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = '';
                    addClassName = '';
                }

                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblSpecialCourses tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                 <td>
                 <div class="d-flex position-relative">
                   <input type="checkbox" id="chkSpecialCourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkSpecialCourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value = "${item.COURSE_CREATION_ID}" ${isChecked}>
                   <label for="chkSpecialCourseOfferChlId${Id}" title="${tooltip}"></label>
                   <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                   <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                   <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                   <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                ${eqIcon}
                   </div>
                 </td>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                 <td class="min-w-200"> 
                 <select class="form-control form-select AppendSelect ${addClassName}" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                </select>
                 </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblSpecialCourses tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });
            //$('#tblSpecialCourses').on('change', 'input[name=chkSpecialCourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["SpecialCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["SpecialCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblSpecialCourses input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblSpecialCourses input[name=chkSpecialCourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["SpecialCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblSpecialCourses input[value=${value}]`).prop("checked", bool)
            //        $(`#tblSpecialCourses input[value=${value}]`).prop("disabled", bool)
            //    })
            //})
            const chkCAllS = document.querySelectorAll('#tblSpecialCourses' + ' .chkAllS');
            chkCAllS.forEach(btn => {
                btn.addEventListener('click', () => {
                    // checkAllFormatter('.chkAll', 'input[name^=chkCourseOfferChlId]');
                    $('input[name^="chkSpecialCourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkSpecialCourseOfferChlId]").prop("checked"));
                })
            })

            $('#tblNotEnlisted tbody').empty();
            if (data.NotEnlistedCourseDetails.length > 0 && enlistmentRuleConfig[0].NOT_STUDIED_COURSES == 1) {
                $('#lblNotEnlisted,#tblNotEnlisted').removeClass("hide");
                $('#lblNotEnlisted,#tblNotEnlisted').removeClass("d-none");
            }
            else {
                $('#lblNotEnlisted,#tblNotEnlisted').addClass("hide");
            }
            $.each(data.NotEnlistedCourseDetails, function (index, item) {
                addClassName = ''; isSectionDisabled = '';
                var Id = index + 1;
                Precnt = Precnt + 1; var tooltip = '';
                var isChecked = item.IS_REGISTERED !== 0 ? 'checked' : '';
                var isDisabled = '';
                var SkipEquivalence = 0;
                var EquivalenceCourseId = 0
                var EquivalenceCourseName = ''

                if (item.PRE_REQUISITE_STATUS == 1) {
                    isDisabled = 'disabled';
                    //isChecked = '';
                    tooltip = 'Pre-Requisite'
                }
                else if (item.IS_SUBJECT_WITHDRAW == 1) {
                    isDisabled = 'disabled';
                    isChecked = '';
                    tooltip = 'Partial Registration Withdrawal'
                }
                if (StudentRegistered == 1) {
                    isDisabled = 'disabled';
                    isSectionDisabled = 'disabled';
                }
                else if (item.CROSS_OFFER == 1 && EnlistmentMethod == 1) {
                    isSectionDisabled = ''; addClassName = '';
                }
                if (item.IS_DROP_GRADE == 1) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Drop with Drop Grade'
                }
                if (item.IS_MANDATORY == 1 && item.PRE_REQUISITE_STATUS == 0) {
                    isDisabled = 'disabled';
                    isChecked = 'checked';
                    tooltip = 'Mandatory Course'
                }

                // Get all matching equivalent course records
                const eqCourses = allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                );

                // Build HTML for all equivalent courses
                const eqContent = eqCourses.length > 0
                    ? `<ul class='mb-0 ps-3'>
        ${eqCourses
                        .map(c => `${c.IS_ONE_WAY_TWO_WAY_COURSE}`)
                        .join('')}
       </ul>`
                    : '';

                // Create popover icon only if equivalent courses exist
                const eqIcon = eqCourses.length > 0
                    ? `<i class="bi bi-arrow-left-right text-info ms-2"
        data-bs-toggle="popover"
        title="Equivalent Courses"
        data-bs-html="true"
        data-bs-content="${eqContent.replace(/"/g, '&quot;')}">
      </i>`
                    : '';

                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID && x.IS_REGISTERED == 1
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    tooltip = 'Equivalence course is already registered'
                    SkipEquivalence = 1;
                }
                if (item.PRE_REQUISITE_STATUS == 0 && item.IS_REGISTERED == 0 && item.IS_MANDATORY == 1 && eqCourses.length > 0 && allCourses.filter(
                    x => x.EQUIVALANCE_COURSE_CREATION_ID === item.COURSE_CREATION_ID
                ).length > 0 &&
                    SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length == 0) {
                    isChecked = '';
                    isDisabled = 'disabled';
                    SkipEquivalence = 1;
                }
                // If more than 1 equivalence course, keep only first active
                if (eqCourses.length > 0) {
                    eqCourses.forEach((course, index) => {

                        const matchedCourse = allCourses.find(
                            x => x.COURSE_CREATION_ID === course.EQUIVALANCE_COURSE_CREATION_ID
                        );

                        var list = {
                            COURSE_CREATION_ID: course.COURSE_CREATION_ID,
                            COURSE_NAME: matchedCourse
                                ? `${matchedCourse.COURSE_CODE} - ${matchedCourse.COURSE_NAME}`
                                : '',
                            EQUIVALANCE_COURSE_CREATION_ID: course.EQUIVALANCE_COURSE_CREATION_ID
                        }
                        OneWayArray.push(list);
                    });
                }
                const matched = OneWayArray.find(
                    x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID
                );

                EquivalenceCourseId = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.EQUIVALANCE_COURSE_CREATION_ID
                    : 0;

                EquivalenceCourseName = matched && matched.COURSE_CREATION_ID > 1
                    ? matched.COURSE_NAME
                    : '';
                if (item.IS_ONE_WAY_TWO_WAY == 1 && item.IS_REGISTERED == 0 && SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.EQUIVALANCE_COURSE_CREATION_ID).length > 0) {

                }
                // Remove duplicate record check
                else if ($("#tblNotEnlisted tbody input[name='hdnCourseCreationId'][value='" + item.COURSE_CREATION_ID + "']").length > 0) {

                } else {
                    var html = `<tr>
                     <td>
                     <div class="d-flex position-relative">
                       <input type="checkbox" id="chkNCourseOfferChlId${Id}" data-equivalence="${EquivalenceCourseId},${EquivalenceCourseName}" data-isequi="${eqIcon == '' ? 0 : 1}" data-isoneway="${item.IS_ONE_WAY_TWO_WAY}" data-oneway="${SkipEquivalence}" data-mandatory="${item.IS_MANDATORY}" data-check=${isChecked == "checked" ? '1' : '0'} data-requisite="${item.PRE_REQUISITE_STATUS},${item.IS_SUBJECT_WITHDRAW}" data-fields="${item.CURRICULUM_CREATION_ID},${item.COURSE_CATEGORY_ID},${item.IS_EXCLUDE},${item.CREDITS}" name="chkNCourseOfferChlId" class="filled-in chkCourseOffer" ${isDisabled} value="${item.COURSE_CREATION_ID}" ${isChecked}>
                       <label for="chkNCourseOfferChlId${Id}" title="${tooltip}"></label>
                       <input type="hidden" id="hdnCourseCreationId" name="hdnCourseCreationId" value="${item.COURSE_CREATION_ID}" />
                       <input type="hidden" id="hdnCrossOffer" name="hdnCrossOffer" value="${item.IS_ONE_WAY_TWO_WAY == 1 ? 1 : item.CROSS_OFFER}" />
                       <input type="hidden" id="hdnNotEnlistedSemesterId" name="hdnNotEnlistedSemesterId" value="${item.ENROLLMENT_SEMESTER_ID}" />
                       <span class="text-warning ms-2">${item.CROSS_OFFER == 1 ? '#' : ''}</span>
                       <button class="btn btn-outline btn-primary btn-sm btn-view ms-2 ${item.PRE_REQUISITE_STATUS == 1 && item.IS_ONE_WAY_TWO_WAY != 1 ? '' : 'd-none'}" data-viewcourse="${item.COURSE_CREATION_ID}"><i class="bi bi-eye icon-sm"></i></button>
                   ${eqIcon}
                       </div>
                     </td>
                     <td>${item.COURSE_CODE}</td>
                     <td>${item.COURSE_NAME}</td>
                     <td>${item.COURSE_TYPE_NAME}</td>
                     <td>${item.CREDITS}</td>                  
                     <td> 
                     <select class="form-control form-select AppendSelect" id="ddlSection${Precnt}" name="ddlSection" tabindex="1" ${isSectionDisabled}>
                    </select>
                     </td>`
                    if (data.IS_SHOW_SEPARATE_SCHEDULE == 1) {
                        if (IsShowSectionRemark == true) {
                            html += `<td><span id="spnSchedule"></span></td><td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `<td><span id="spnSchedule"></span></td></tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").removeClass("d-none");
                    } else {
                        if (IsShowSectionRemark == 1) {
                            html += `<td><span id="spnRemark"></span></td></tr>`
                            $(".clsRemark").removeClass("d-none");
                        } else {
                            html += `</tr>`
                            $(".clsRemark").addClass("d-none");
                        }
                        $(".clshideScheduleAsPerConfig").addClass("d-none");
                    }

                    $('#tblNotEnlisted tbody').append(html);
                }
                RenderDropDown($('#ddlSection' + Precnt), SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID), 'SECTION_CREATION_ID', 'SECTION_NAME');
                if (EnlistmentMethod == 3) {
                    if (SectionData['SectionDetails'].filter(x => x.COURSE_CREATION_ID == item.COURSE_CREATION_ID).length > 0) {
                        $('#ddlSection' + Precnt).prop("selectedIndex", 1);
                        if (item.SECTION_CREATION_ID > 0) {
                            $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                        }
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                    else { $('#ddlSection' + Precnt).prop("selectedIndex", 0); }
                }
                else {
                    $('#ddlSection' + Precnt).val(item.SECTION_CREATION_ID);
                    if (item.SECTION_CREATION_ID > 0) {
                        var selectedValue1 = $('#ddlSection' + Precnt).val();
                        var $row1 = $('#ddlSection' + Precnt).closest('tr');
                        var sectionCourseId1 = $row1.find("#hdnCourseCreationId").val();
                        var $scheduleSpan1 = $row1.find("#spnSchedule");
                        var $spnRemark1 = $row1.find("#spnRemark");
                        $scheduleSpan1.html(''); $spnRemark1.html('');

                        if (SectionScheduleData.length == 0) {
                            $scheduleSpan1.html(''); $spnRemark1.html('');
                        } else {
                            let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId1 &&
                                x.CAMPUS_ROOM_ID == selectedValue1
                            )
                            var ScheduleData = '';
                            $.each(ArrayList, function (index, item) {
                                ScheduleData += ArrayList[index].COURSE_NAME;
                            });
                            $scheduleSpan1.html(ScheduleData);

                            if (ArrayList.length > 0) {
                                const maxLength = 50;
                                const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                                if (remark.length > 0) {
                                    if (remark.length > maxLength) {
                                        $spnRemark1.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                    } else {
                                        $spnRemark1.text(remark);
                                    }
                                } else {
                                    $spnRemark1.html('');
                                }
                            }
                        }
                    }
                }
                $('#ddlSection' + Precnt).on('change', function () {
                    var $dropdown = $(this);
                    var selectedValue = $dropdown.val();
                    var $row = $dropdown.closest('tr');
                    var sectionCourseId = $row.find("#hdnCourseCreationId").val();
                    var $scheduleSpan = $row.find("#spnSchedule");
                    var $spnRemark = $row.find("#spnRemark");
                    $scheduleSpan.html(''); $spnRemark.html('');
                    if (SectionScheduleData.length == 0) {
                        $scheduleSpan.html(''); $spnRemark.html('');
                    } else {
                        let ArrayList = SectionScheduleData.filter(x => x.COURSE_CREATION_ID == sectionCourseId &&
                            x.CAMPUS_ROOM_ID == selectedValue
                        )
                        var ScheduleData = '';
                        $.each(ArrayList, function (index, item) {
                            ScheduleData += ArrayList[index].COURSE_NAME;
                        });
                        $scheduleSpan.html(ScheduleData);

                        if (ArrayList.length > 0) {
                            const maxLength = 50;
                            const remark = (ArrayList[0].SECTION_REMARK || "").trim();

                            if (remark.length > 0) {
                                if (remark.length > maxLength) {
                                    $spnRemark.html(`
                <span class="short-text">${remark.substring(0, maxLength)}...</span>
                <span class="full-text d-none">${remark}</span>
                <a href="javascript:void(0);" class="toggleRemark ms-1">Read More</a>
            `);
                                } else {
                                    $spnRemark.text(remark);
                                }
                            } else {
                                $spnRemark.html('');
                            }
                        }
                    }
                });
                //$(".loader-area, .loader").fadeOut('slow');
                //$('#ddlSection' + Precnt).val(courseReg ? courseReg.SECTION_CREATION_ID : 0).select2();

                const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
                popoverTriggerList.forEach(function (el) {
                    new bootstrap.Popover(el, {
                        trigger: 'hover', // show on hover
                        placement: 'right', // optional: top, bottom, left, right
                        html: true
                    });
                });
            });

            $(document).off("click", ".toggleRemark").on("click", ".toggleRemark", function () {
                const $container = $(this).parent();

                $container.find(".short-text").toggleClass("d-none");
                $container.find(".full-text").toggleClass("d-none");

                $(this).text($(this).text() === "Read More" ? "Read Less" : "Read More");
            });
            $(".AppendSelect").select2();
            //$('#tblNotEnlisted').on('change', 'input[name=chkNCourseOfferChlId]', function () {
            //    const $this = $(this);
            //    const isChecked = $this.prop("checked");
            //    const courseId = $this.val();

            //    const course = CourseDetailsList["NotEnlistedCourseDetails"].find(x => x.COURSE_CREATION_ID == courseId);
            //    if (!course || !course.CO_REQUISITE_COURSE_ID) return;

            //    const coReqIds = course.CO_REQUISITE_COURSE_ID.split(',');

            //    for (const id of coReqIds) {
            //        const coReqCourse = CourseDetailsList["NotEnlistedCourseDetails"].find(x => x.COURSE_CREATION_ID == id);
            //        if (coReqCourse) {
            //            const $input = $(`#tblNotEnlisted input[value="${id}"]`);
            //            $input.prop("checked", isChecked).prop("disabled", coReqCourse.PRE_REQUISITE_STATUS == 1 ? true : isChecked);
            //        }
            //    }
            //});
            //$('#tblNotEnlisted input[name=chkNCourseOfferChlId]').change(function () {
            //    var bool = $(this).prop("checked");
            //    $.each(CourseDetailsList["NotEnlistedCourseDetails"].find(x => x.COURSE_CREATION_ID == $(this).val()).CO_REQUISITE_COURSE_ID.split(','), function (index, value) {
            //        $(`#tblNotEnlisted input[value=${value}]`).prop("checked", bool)
            //        $(`#tblNotEnlisted input[value=${value}]`).prop("disabled", bool)
            //    });
            //});
            const chkNAll = document.querySelectorAll('#tblNotEnlisted' + ' .chkAllN');
            chkNAll.forEach(btn => {
                btn.addEventListener('click', () => {
                    //checkAllFormatter('.chkAll', 'input[name^=chkECourseOfferChlId]');
                    $('input[name^="chkNCourseOfferChlId"]:not(:disabled)').prop("checked", $("input[id=chkNCourseOfferChlId]").prop("checked"));
                })
            });
            if (StudentRegistered != 1) {
                if (StdApprovalStatus > 0 && (EnlistmentMethod == 2 || EnlistmentMethod == 3)) {
                    buildCourseLookup();
                } else if (StdApprovalStatus == 0 && (EnlistmentMethod == 2 || EnlistmentMethod == 3)) {
                    buildCourseLookup();
                } else if (EnlistmentMethod == 1) {
                    buildCourseLookup();
                }
            }
            if (EnlistmentMethod == 1) {
                $(".thEnlistmentMethod").prop("disabled", true);
                $("#configStep2Section").show();

                DistinctSection = [];
                $.each(SectionData['SectionDetails'], function (index, row) {
                    if (!DistinctSection.find(x => x.SECTION_CREATION_ID == row.SECTION_CREATION_ID && x.CORE_CROSS == 1)) {
                        DistinctSection.push(row);
                    }
                })
                // Clean the SECTION_NAME by removing {Schedule: [...]} part
                let CleanedSection = DistinctSection.filter(x => x.CORE_CROSS == 1).map(row => ({
                    ...row,
                    SECTION_NAME: row.SECTION_NAME.replace(/\{Schedule:.*?\}\s*/g, '').trim()
                }));
                RenderDropDown($('#ddlStep2Section'), CleanedSection, 'SECTION_CREATION_ID', 'SECTION_NAME');
                $('#ddlStep2Section').val(data.SECTION_CREATION_ID).select2();
                if (data.SECTION_CREATION_ID == 0) {
                    $('#ddlStep2Section').prop('disabled', false);
                }
                else {
                    if (StudentRegistered == 0 && StdApprovalStatus > 0) {
                        $('#ddlStep2Section').prop('disabled', false);
                        $('#ddlStep2Section').change();
                    } else {
                        $('#ddlStep2Section').prop('disabled', true);
                    }
                }
            }
            else {
                $('#ddlStep2Section option:not(:first)').remove();
                $('#ddlStep2Section').val(0).select2();
                $('#ddlStep2Section').prop('disabled', false);
            }
            $('#tblExemptedCourses tbody').empty();
            if (data.GetExemptedCourseDetails.length > 0) {
                $('#lblExempted').text("Credited Courses");
                $('#lblExempted,#divExempted').removeClass("hide");
                $('#lblExempted,#divExempted').removeClass("d-none");
            }
            else {
                $('#lblExempted,#divExempted').addClass("hide");
            }
            $.each(data.GetExemptedCourseDetails, function (index, item) {
                var html = `<tr>
                 <td>${item.COURSE_CODE}</td>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.COURSE_TYPE_NAME}</td>
                 <td>${item.CREDITS}</td>                  
                </tr>`
                $('#tblExemptedCourses tbody').append(html);
            });

            // }

            //});
        } catch (error) {
            console.error(error);
        } finally {
            hideFullPageLoader();
        }
    };
    $('#tblRegularCourses').on("click", 'input[name="chkCourseOfferChlId"]', function () {
        if ($('input[name^="chkCourseOfferChlId"]:checked').length == CourseDetailsList.CourseDetails.length) {
            $('.chkAll').prop('checked', true);
        } else {
            $('.chkAll').prop('checked', false);
        }
    })
    $('#tblElectiveCourses').on("click", 'input[name="chkECourseOfferChlId"]', function () {
        if ($('input[name^="chkECourseOfferChlId"]:checked').length == CourseDetailsList.ElectiveCourseDetails.length) {
            $('.chkAllE').prop('checked', true);
        } else {
            $('.chkAllE').prop('checked', false);
        }
    })
    $('#tblGlobalCourses').on("click", 'input[name="chkGCourseOfferChlId"]', function () {
        if ($('input[name^="chkGCourseOfferChlId"]:checked').length == CourseDetailsList.GlobelElectiveCourseDetails.length) {
            $('.chkAllG').prop('checked', true);
        } else {
            $('.chkAllG').prop('checked', false);
        }
    })
    $('#tblRestudyCourses').on("click", 'input[name="chkRestudyCourseOfferChlId"]', function () {
        if ($('input[name^="chkRestudyCourseOfferChlId"]:checked').length == CourseDetailsList.GetRestudyCourseDetails.length) {
            $('.chkAllR').prop('checked', true);
        } else {
            $('.chkAllR').prop('checked', false);
        }
    })
    $('#tblMinorMajorCourses').on("click", 'input[name="chkMinorMajorOfferChlId"]', function () {
        if ($('input[name^="chkMinorMajorOfferChlId"]:checked').length == CourseDetailsList.GetMinorMajorCourseDetails.length) {
            $('.chkAllM').prop('checked', true);
        } else {
            $('.chkAllM').prop('checked', false);
        }
    })
    $('#tblSpecialCourses').on("click", 'input[name="chkSpecialCourseOfferChlId"]', function () {
        if ($('input[name^="chkSpecialCourseOfferChlId"]:checked').length == CourseDetailsList.SpecialCourseDetails.length) {
            $('.chkAllS').prop('checked', true);
        } else {
            $('.chkAllS').prop('checked', false);
        }
    })
    $('#tblNotEnlisted').on("click", 'input[name="chkNCourseOfferChlId"]', function () {
        if ($('input[name^="chkNCourseOfferChlId"]:checked').length == CourseDetailsList.NotEnlistedCourseDetails.length) {
            $('.chkAllN').prop('checked', true);
        } else {
            $('.chkAllN').prop('checked', false);
        }
    })

    $("#DownLoadReceipt").click(function () {
        generatePDF("printEnlistmentSlip", "EnlistmentSlip");
    })
    $("#btnClose").click(function () {
        $("input[name='EnrollmentOption']").prop("checked", false);
        $('#ddlTimeSlot').val(0).select2();
    });
    /*
NAME  : data-viewcourse
DESC  : Handles click event on anchor tags with data-sectioncreationid attribute.
PARAMS: None
OUTPUT: Updates student details table with data fetched asynchronously.
*/
    $(document).on('click', 'button[data-viewcourse]', function () {
        $(".loader-area, .loader").css("display", "block");
        var formData = {
            Coursecreationid: $(this).data('viewcourse'),
            SemesterId: enrollmentSemesterId,
            academicSessionId: $("#hdfAcademicSessionId").val()
        }
        $.ajax({
            url: "/Enlistment/GetPrerequisiteCourses/",
            type: 'POST',
            data: formData,
            success: function (data) {
                $("#DivShowRequisite").modal('show');
                $('#tblRequisiteList tbody').empty();
                if (data.length > 0) {
                    $.each(data, function (index, item) {
                        var html = `<tr>
                 <td>${item.COURSE_NAME}</td>
                 <td>${item.GRADE_NAME}</td>
                 <td>${item.EARN_CREDIT}</td>             
                </tr>`
                        $('#tblRequisiteList tbody').append(html);
                    });
                } else {
                    $('#tblRequisiteList tbody').empty();
                }
            }
        });
        $(".loader-area, .loader").fadeOut('slow');
    });
    /*
  NAME  : generatePDF
  DESC  : Generates a PDF from the content of a specified HTML element.
  PARAMS:printDivId,dFileName
  OUTPUT: NA
*/
    function generatePDF(printDivId, dFileName) {
        var htmlContent = document.getElementById(printDivId).innerHTML;
        var options = {
            // margin: [0.1, 0.1, 0.1, 0.1], // Adjusted margins
            filename: dFileName || 'EnlistmentSlip.pdf',
            image: { type: 'jpeg', quality: 1 },
            html2canvas: { scale: 2 }, // You can adjust this value if needed
            jsPDF: { unit: 'in', format: 'A4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] } // Improved pagebreak options
        };
        html2pdf().from(htmlContent).set(options).save();
    }

    /*
         NAME  :ScheduleEvent
         DESC  :get time table schedule data
         PARAMS:startdate,enddate,STUDENT_ID
         OUTPUT:COURSE_CREATION_ID,COURSE_NAME,COURSE_CODE,CAMPUS_ROOM_ID,ROOM_NAME,TIME_TABLE_DATE,TIME_FROM,TIME_TO,MST_MODE_ID,IS_RECESS
     */
    var ScheduleEvent = function () {
        let currentWeekOffset = 0; // 0 = current week, -1 = previous week, 1 = next week

        const updateWeekDisplay = () => {
            if (currentWeekOffset === 0) {
                $('#week').text('Schedule Week');
            } else if (currentWeekOffset < 0) {
                $('#week').text('Previous Week');
            } else {
                $('#week').text('Next Week');
            }
        };

        const loadWeekData = (offset) => {
            currentWeekOffset = offset;
            updateWeekDisplay();

            const startDate = new moment(formattedStartDate).add(offset * 7, 'd');
            const endDate = moment(startDate).endOf('isoWeek');

            BindScheduleThead(new moment(startDate));
            GetScheduleData(startDate.format('YYYY-MM-DD'), endDate.format('YYYY-MM-DD'));
        };

        $('#btnPre').click(function () {
            loadWeekData(currentWeekOffset - 1);
        });

        $('#btnNext').click(function () {
            loadWeekData(currentWeekOffset + 1);
        });

        // Initialize with current week
        loadWeekData(0);
    };
    /*
         NAME  :btnSchedule
         DESC  :get time table schedule data
         PARAMS:startdate,enddate,STUDENT_ID
         OUTPUT:COURSE_CREATION_ID,COURSE_NAME,COURSE_CODE,CAMPUS_ROOM_ID,ROOM_NAME,TIME_TABLE_DATE,TIME_FROM,TIME_TO,MST_MODE_ID,IS_RECESS
     */

    $('#btnSchedule').click(function () {
        ScheduleEvent();
        //  $('#TimetableModal').appendTo('body');
        weekTab = 1;
        $('#week').text('Schedule Week');

        //weekStartDate.toDateString();

        BindScheduleThead(new moment(formattedStartDate));
        //let startDate = new moment(formattedStartDate);

        //GetScheduleData(startDate.format('YYYY-MM-DD'), moment(startDate).endOf('isoWeek').format('YYYY-MM-DD'));
    });
    /*
  NAME  : GetScheduleData
  DESC  : Fetches schedule data based on selected courses and sections, and displays it in a modal for a specified date range.
  PARAMS:startDate,endDate
  OUTPUT: Displays schedule data in a modal.
*/
    var GetScheduleData = async function (startDate, endDate) {

        var validate = false; var EnlistmentScheduleArray = new Array();
        $("#tblRegularCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                /*if (EnlistmentMethod !== 1) {*/
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Core Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblElectiveCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                //if (EnlistmentMethod !== 1) {
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Elective Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblGlobalCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                //if (EnlistmentMethod !== 1) {
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Global Elective Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblRestudyCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                //if (EnlistmentMethod !== 1) {
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Restudy Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=chkRestudyCourseOfferChlId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblMinorMajorCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1 && validate == false) {
                /*if (EnlistmentMethod !== 1) {*/
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Minor Major Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=chkMinorMajorOfferChlId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblSpecialCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                /*if (EnlistmentMethod !== 1) {*/
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Special Offer Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=chkSpecialCourseOfferChlId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        $("#tblNotEnlisted tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1 && validate == false) {
                /*if (EnlistmentMethod !== 1) {*/
                if ($(this).find($('[id^=ddlSection]')).val() == "0" || $(this).find($('[id^=ddlSection]')).val() == null) {
                    iziToast.warning({ message: `Please Select Section for ` + $(this).find('td:eq(1)').text().trim() + ' in Not Enlisted Course.' })
                    validate = true;
                    return false;
                }
                var list = {
                    COURSE_CREATION_ID: $(this).find($('[id^=chkNCourseOfferChlId]')).val(),
                    SECTION_CREATION_ID: $(this).find($('[id^=ddlSection]')).val(),
                    CAMPUSNO: campusNo
                }
                EnlistmentScheduleArray.push(list);
            }
        });
        if (validate == true) {
            return;
        }
        if (EnlistmentScheduleArray.length == 0) {
            iziToast.warning({ message: `Please Select atleast one Course !` })
            return false;
        }

        var Formdata = {
            STARTDATE: startDate,
            ENDDATE: endDate,
            ACADEMICSESSIONID: $("#hdfAcademicSessionId").val(),
            enlistmentSchedule: EnlistmentScheduleArray
        }
        $('#tblSchedule tbody').empty();
        $('#btnSchedule').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
  <span class="">Loading...</span>`);
        try {
            let data = await $.ajax({
                url: "/Enlistment/GetScheduleData/",
                data: Formdata,
                type: "POST",
                dataType: "json"
            });
            //async: false,
            //success: function (data) {
            TimeTableWeekly(data);
            // }

            $('#TimetableModal').modal('show');
        } catch (error) {
            console.error(error);

        } finally {
            $('#btnSchedule')
                .prop('disabled', false)
                .text('Schedule');
        }
    }
    /*
  NAME  : BindScheduleThead
  DESC  : Binds the table header with date information.
  PARAMS: date
  OUTPUT: Populates the table header with day names and corresponding dates.
*/
    var BindScheduleThead = function (date) {
        $('#schedulehead').empty();
        var head = `<tr>
                                                <th class="text-center min-w-160" >Time Slot</th>
                                                <th class="text-center min-w-160">Mon <span class="date">${date.format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Tue <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Wed <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Thu <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Fri <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Sat <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                                <th class="text-center min-w-160">Sun <span class="date">${date.add(1, 'd').format('DD/MM')}</span></th>
                                            </tr>`
        $('#schedulehead').append(head);
    }
    /*
  NAME  : TimeTableWeekly
  DESC  : Populates the weekly timetable table with schedule data.
  PARAMS: data
  OUTPUT: Renders the timetable table with the schedule data.
*/
    var TimeTableWeekly = function (data) {
        $('#tblSchedule tbody').empty();
        if (data.length > 0) {
            $.each(data.map(x => x.TIME_FROM + ' - ' + x.TIME_TO).filter((value, index, array) => array.indexOf(value) === index), function (index, value) {
                var html = `<tr>
                                <td>${value}</td>`;
                for (var i = 1; i < 8; i++) {
                    var item = data.find(x => x.TIME_FROM.trim() == value.split('-')[0].trim() && x.TIME_TO.trim() == value.split('-')[1].trim() && (new moment(x.TIME_TABLE_DATE).day()) == (i == 7 ? 0 : i));
                    if (data.find(x => x.TIME_FROM.trim() == value.split('-')[0].trim() && x.TIME_TO.trim() == value.split('-')[1].trim())?.COURSE_NAME == "RECESS") {
                        if (data.find(x => (new moment(x.TIME_TABLE_DATE).day()) == (i == 7 ? 0 : i))) {
                            html += `<td>
                                    <span class="text-primary">RECESS</span >
                                </td>`;
                        }
                        else {
                            html += `<td>
                                    <span class="text-primary"></span >
                                </td>`;
                        }

                    }
                    else {
                        html += `<td>
                                    ${item ? decodeHtmlEntities(item.COURSE_NAME) : ""}
                                    
                                </td>`;
                    }
                }
                html += `</tr>`;
                $('#tblSchedule tbody').append(html);
            });
        }
        else {
            $('#tblSchedule tbody').html('<tr class="no-records"><td colspan="8" class="text-center">Data not found</td></tr>');
        }
    }
    /*
  NAME  : EnlistmentStatusFormatter
  DESC  : Formats the enlistment status value into HTML buttons based on different status values.
  PARAMS:value,row,index
  OUTPUT: Returns HTML buttons representing the enlistment status.
*/
    function EnlistmentStatusFormatter(value, row, index) {
        if (value == 2) {
            var IsShowId = '';
            var isDisabled = (
                IsGenerateDemandRuntime == null ||
                IsGenerateDemandRuntime == 1 ||
                IsDemandGenerated == 1
            ) ? '' : 'disabled';

            if (isDisabled === 'disabled') {
                IsShowId = 'btnNotGenerated';
                $("#spnEnlistmentSlipNote").removeClass("d-none"); // Show
            } else {
                IsShowId = 'btnTimeTable';
                $("#spnEnlistmentSlipNote").addClass("d-none"); // Hide
            }

                return `
               <button type="button" tabindex="1" class="btn btn-success" id="btnstatus">
                <i class="bi bi-clipboard2-check"></i> Your Enlistment status has been Approved
                </button>
              <button type="button" class="btn btn-primary btn-outline common-cancel-btn" tabindex="1" id="${IsShowId}" ${isDisabled}>
              Enlistment Slip
               </button>
        `;
        } else if (value == 1 || value == 0) {
            return `
            <button type="button" tabindex="1" class="btn btn-warning" id="btnstatus">
                <i class="bi bi-clipboard2-check"></i> Your Enlistment status has been Pending
            </button>
        `;
        } else if (value == 3) {
            return `
            <button type="button" tabindex="1" class="btn btn-danger" id="btnstatus">
                <i class="bi bi-clipboard2-check"></i> Your Enlistment status has been Rejected
            </button>
        `;
        }
    }
    /*
NAME  : GetPaymentModeConfiguration
DESC  : Get the payment mode configuration details.
PARAMS: NA
OUTPUT: Configuration list
*/
    async function GetPaymentModeConfiguration() {
        let data = await $.ajax({
            url: "/Enlistment/GetPaymentModeConfiguration/",
            type: 'post'
        });
        //async: false,
        // success: function (data) {

        PAYMENT_MODE_CONDIG_LIST = data['PAYMENT_MODE_CONDIG_LIST'];

        RenderDropDown($('#ddlBank'), data["PAYMENT_CENTER_LIST"], 'BANK_ID', 'BANK_NAME');

        RenderDropDown($('#ddlPaymentGateway'), data["PAYMENT_GATEWAY_LIST"], 'PAYMENT_GATEWAY_ID', 'PAYMENT_GATEWAY_NAME');

        BindPaymentModeConfigData(data['PAYMENT_MODE_CONDIG_LIST']);

        BindPaymentCenterBanksData(data['PAYMENT_CENTER_LIST']);

        BindPaymentCenterFieldsData(data['PAYMENT_CENTER_FIELD_CONFIG_LIST']);
        //  }

    }
    /*
NAME  : BindPaymentModeConfigData
DESC  : Binds payment mode configuration data to UI elements.
PARAMS: data - Payment mode configuration data.
OUTPUT: NA
*/
    var BindPaymentModeConfigData = function (data) {
        if (data[0].IS_UPLOAD == true) {
            $("#ReceiptPayAtcampusMadanatory").text("*")
        }
        if (data[1].IS_UPLOAD == true) {
            $("#ReceiptPayAtBankMadanatory").text("*")
        }

        PaymentModeValidation = data;
        for (var i = 0; i < data.length; i++) {
            if (data[i].IS_ACTIVE == false) {
                $(".payment-mode-" + data[i].PAYMENT_MODE_ID + "").hide();

                html = '<b><span>Currently this payment option is not available!</span></b>'
                $("#PayatInstruction" + data[i].PAYMENT_MODE_ID + "").empty().append(html);
            }
            else {
                if (data[i].NOTE != '') {
                    html = '<b>Instructions : <span>' + data[i].NOTE + '</span></b>'
                    $("#PayatInstruction" + data[i].PAYMENT_MODE_ID + "").empty().append(html);
                }
            }
        }
    };
    /*
      NAME  : BindPaymentCenterBanksData
      DESC  : Populates bank details within the UI.
      PARAMS: data - Bank details data.
      OUTPUT: NA
    */
    var BindPaymentCenterBanksData = function (data) {
        $('.BankDetails').empty();
        $.each(data, function (index, row) {
            var htmlbody = `<div class="col-lg-6 col-md-6 col-12 mt-3">
                                <ul class="course-overview list-unstyled b-1 bg-gray-100 mb-0">
                                    <li><span class="tag">Account No: </span> <span class="value">${row.BANK_ACCOUNT_NUMBER}</span></li>
                                    <li> <span class="tag">IFSC Code:</span><span class="value">${row.BANK_CODE}</span></li>
                                    <li><span class="tag">Account Holder Name: </span> <span class="value">${row.BENEFICIARY_NAME}</span></li>
                                    <li><span class="tag">Branch Name:</span><span class="value">${row.BANK_NAME}</span></li>
                                </ul>
                            </div>`;

            $('.BankDetails').append(htmlbody);
        });
    };
    /*
      NAME  : BindPaymentCenterFieldsData
      DESC  : Displays or hides payment center fields in the UI based on provided data.
      PARAMS: data - Payment center fields data.
      OUTPUT: NA
    */
    var BindPaymentCenterFieldsData = function (data) {
        $('#FieldDiv_PaymentCenter').hide();
        $('#FieldDiv_TransactionDate').hide();
        $('#FieldDiv_ReferenceId').hide();
        $.each(data, function (index, row) {
            $('#Field' + row.FIELD_DIV_ID).show();
        });
    };
    /*
  NAME  : fileUploadReceiptPayAtCampusChangeHandler
  DESC  : Handles the change event for the file upload input field to validate uploaded files.
  PARAMS: NA
  OUTPUT: False if the uploaded file doesn't meet the validation criteria, otherwise allows the file to be uploaded.
*/
    $('#fileUploadReceiptPayAtCampus').change(function () {
        var input = this;
        if (input.files && input.files[0]) {
            const filename = checkInputValidation((input.files[0].name).substring(0, input.files[0].name.lastIndexOf('.')));
            var extension = input.files[0].name.substr((input.files[0].name.lastIndexOf('.') + 1));
            if (extension.toUpperCase() == 'PDF' || extension.toUpperCase() == 'JPEG'
                || extension.toUpperCase() == 'JPG' || extension.toUpperCase() == 'PNG') {
                if (input.files[0].size > 500000) {
                    $(this).val("");
                    iziToast.warning({ message: 'Max size 500kb!', title: 'Warning!' });
                    return false;
                }
                else if (filename.isSpecialCharacters == true) {
                    $(this).val("");
                    iziToast.warning({ message: 'Special Characters Not Allowed In File Name', title: 'Warning!' });
                    return false;
                }
            }
            else {
                $(this).val("");
                //iziToast.warning({ message: 'Please select PDF file only', title: 'Warning!' });
                iziToast.warning({ message: 'Unsupported file type', title: 'Warning!' });
                return false;
            }
        }
    });
    /*
  NAME  : fileUploadReceiptPayAtCenterChangeHandler
  DESC  : Handles the change event for the file upload input field at the center to validate uploaded files.
  PARAMS: NA
  OUTPUT: False if the uploaded file doesn't meet the validation criteria, otherwise allows the file to be uploaded.
*/
    $('#fileUploadReceiptPayAtCenter').change(function () {
        var input = this;
        if (input.files && input.files[0]) {
            const filename = checkInputValidation((input.files[0].name).substring(0, input.files[0].name.lastIndexOf('.')));
            var extension = input.files[0].name.substr((input.files[0].name.lastIndexOf('.') + 1));
            if (extension.toUpperCase() == 'PDF' || extension.toUpperCase() == 'JPEG'
                || extension.toUpperCase() == 'JPG' || extension.toUpperCase() == 'PNG') {
                if (input.files[0].size > 500000) {
                    $(this).val("");
                    iziToast.warning({ message: 'Max size 500kb!', title: 'Warning!' });
                    return false;
                }
                else if (filename.isSpecialCharacters == true) {
                    $(this).val("");
                    iziToast.warning({ message: 'Special Characters Not Allowed In File Name', title: 'Warning!' });
                    return false;
                }
            }
            else {
                $(this).val("");
                //iziToast.warning({ message: 'Please select PDF file only', title: 'Warning!' });
                iziToast.warning({ message: 'Unsupported file type', title: 'Warning!' });
                return false;
            }
        }
    });
    /*
 NAME  : btnPayNowClickHandler
 DESC  : Handles the click event for the 'Pay Now' button to initiate the payment process.
 PARAMS: NA
 OUTPUT: False if any validation fails or if the payment process cannot be initiated, otherwise proceeds with the payment process.
*/
    $('#btnPayNow').click(function () {
        var PaymentModeData = PAYMENT_MODE_CONDIG_LIST.find(x => x.PAYMENT_MODE_ID == 3);

        if (PaymentModeData == undefined) {
            iziToast.warning({ message: 'Invalid data!' });
            return false;
        }

        if (PaymentModeData.IS_ACTIVE == false) {
            iziToast.warning({ message: 'Currently this payment option is not available!' });
            return false;
        }

        if ($('#ddlPaymentGateway').val() == 0 || $("#ddlPaymentGateway").val() == "") {
            iziToast.warning({ message: 'Please select payment gateway!' });
            return false;
        }

        var totalPayment = 0;
        var paymentDescription = 'Enlistment Payment';
        var DemandArray = new Array();

        totalPayment = demandAmount;

        if (parseFloat($('#hdnPayTotalAmount').val()) != parseFloat(totalPayment)) {
            return iziToast.warning({ message: 'Total amount and selected payment amount not match, Please again click on Proceed to Payment.' });
        }

        CreateDownPaymentDemand(totalPayment);
        var list = {
            DEMANDPG_ID: parseInt(demandpgId),
            AMOUNT: parseFloat(demandAmount)
        }
        DemandArray.push(list);

        var formData = {
            STUDENT_ID: studentId,
            PAYMENT_DESCRIPTION: paymentDescription,
            PAGE_NAME: "Enlistment/Index", //Controller/ActionName
            PAYMENT_GATEWAY_NO: $('#ddlPaymentGateway').val(),
            DEMAND_TBL: DemandArray
        };

        $('#btnPayNow').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="">Loading...</span>`);
        OnlinePaymentRequest.CreatePaymentRequest(formData);
        $('#btnPayNow').removeAttr('disabled').empty().append('<i class="bi bi-credit-card"></i> Pay');
        //$('#spnOnlinePayementSataus').addClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
        //$('#spnDownPayStaus,#divDownPayStatus').addClass("d-none");
    });
    /*
  NAME  : btnSubmitPayAtCampusClickHandler
  DESC  : Handles the click event for the 'Submit' button for making a payment at the campus, including file upload and payment validation.
  PARAMS: NA
  OUTPUT: False if any validation fails or if the payment process cannot be initiated, otherwise proceeds with the payment process.
*/
    $('#btnSubmitPayAtCampus').click(function () {
        var PaymentModeData = PAYMENT_MODE_CONDIG_LIST.find(x => x.PAYMENT_MODE_ID == 1);

        if (PaymentModeData == undefined) {
            iziToast.warning({ message: 'Invalid data!' });
            return false;
        }

        if (PaymentModeData.IS_ACTIVE == false) {
            iziToast.warning({ message: 'Currently this payment option is not available!' });
            return false;
        }

        if (PaymentModeData.IS_UPLOAD == true) {
            if ($('#fileUploadReceiptPayAtCampus').val().trim() == '') {
                $('#fileUploadReceiptPayAtCampus').focus();
                iziToast.warning({ message: 'Please Select Attachment' });
                return false;
            }
        }

        var input = $('#fileUploadReceiptPayAtCampus');
        if (input.files && input.files[0]) {
            const filename = checkInputValidation((input.files[0].name).substring(0, input.files[0].name.lastIndexOf('.')));
            var extension = input.files[0].name.substr((input.files[0].name.lastIndexOf('.') + 1));
            if (extension.toUpperCase() == 'PDF' || extension.toUpperCase() == 'JPEG'
                || extension.toUpperCase() == 'JPG' || extension.toUpperCase() == 'PNG') {
                if (input.files[0].size > 500000) {
                    iziToast.warning({ message: 'Max size 500kb!', title: 'Warning!' });
                    return false;
                }
                else if (filename.isSpecialCharacters == true) {
                    iziToast.warning({ message: 'Special Characters Not Allowed In File Name', title: 'Warning!' });
                    return false;
                }
            }
            else {
                //iziToast.warning({ message: 'Please select PDF file only', title: 'Warning!' });
                iziToast.warning({ message: 'Unsupported file type', title: 'Warning!' });
                return false;
            }
        }

        var totalPayment = 0;
        var DemandArray = new Array();

        totalPayment = parseFloat(demandAmount);

        if (parseFloat($('#hdnPayTotalAmount').val()) != parseFloat(totalPayment)) {
            return iziToast.warning({ message: 'Total amount and selected payment amount not match, Please again click on Proceed to Payment.' });
        }

        CreateDownPaymentDemand(totalPayment);
        var list = {
            DEMANDPG_ID: parseInt(demandpgId),
            INSTALLMENT_NO: parseInt(0),
            AMOUNT: parseFloat(demandAmount)
        }
        DemandArray.push(list);

        var formData = {
            STUDENT_ID: studentId,
            TOTAL_AMOUNT: totalPayment,
            AMOUNT: totalPayment,
            PAYMENT_MODE: '1',
            IS_WANT_ORIGINAL_RECEIPT: Number($('#isOfficialReceiptPayeCampus').is(':checked')),
            PAGE_NAME: 'Enlistment/Index',
            DEMAND_TABLE: DemandArray
        };

        var fileData = new FormData();
        const files = $("#fileUploadReceiptPayAtCampus")[0].files;
        fileData.append('FILE_LIST', files[0]);
        if (files.length > 0) {
            FileDataByAppend(fileData);
        }
        $('#btnSubmitPayAtCampus').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="">Loading...</span>`);
        $.ajax({
            url: "/Enlistment/SaveStudentPaymentPayAtOfflineData/",
            type: "POST",
            data: JSON.stringify(formData),
            contentType: "application/json;charset=utf-8",
            success: function (data) {
                if (data == -1) {
                    iziToast.warning({ message: 'Amount should be greater than 0!' });
                }
                else if (data == -2) {
                    iziToast.warning({ message: 'Invalid data!' });
                }
                else if (data == -3) {
                    iziToast.warning({ message: 'You can not pay amount greater than receivable amount!' });
                }
                else if (data == -4) {
                    iziToast.warning({ message: 'Something went wrong please try later or contact to ypur institute!' });
                }
                else if (data == -5) {
                    iziToast.warning({ message: 'You can not pay multiple currency payment at same time!' });
                }
                else {
                    CommonCallBack(data.substring(0, 3));
                }
                $('#btnSubmitPayAtCampus').removeAttr('disabled').empty().text('Submit');
                if (data == 1) {
                    $('#fileUploadReceiptPayAtCampus').val('');
                    $('#isOfficialReceiptPayeCampus').prop("checked", false);
                    $('#spnOnlinePayementSataus').removeClass("d-none");
                    $('#spnDownPayStaus').addClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
                }
            }
        });
    });
    /*
  NAME  : btnSubmitPayAtPaymentCenterClickHandler
  DESC  : Handles the click event for the 'Submit' button for making a payment at the payment center, including file upload and payment validation.
  PARAMS: NA
  OUTPUT: False if any validation fails or if the payment process cannot be initiated, otherwise proceeds with the payment process.
*/
    $('#btnSubmitPayAtPaymentCenter').click(function () {
        var PaymentModeData = PAYMENT_MODE_CONDIG_LIST.find(x => x.PAYMENT_MODE_ID == 2);

        if (PaymentModeData == undefined) {
            iziToast.warning({ message: 'Invalid data!' });
            return false;
        }

        if (PaymentModeData.IS_ACTIVE == false) {
            iziToast.warning({ message: 'Currently this payment option is not available!' });
            return false;
        }

        if ($('#ddlBank').val() == 0 || $("#ddlBank").val() == "") {
            CommonWarningMsg('#ddlBank');
            return false;
        }
        else if ($("#txtAmount").val().trim() == "") {
            CommonWarningMsg('#txtAmount');
            return false;
        }

        if (parseFloat($("#txtAmount").val().trim()) <= 0) {
            $('#txtAmount').focus();
            iziToast.warning({ message: 'Please Enter Amount Greater Than 0' });
            return false;
        }

        if (PaymentModeData.IS_UPLOAD == true) {
            if ($('#fileUploadReceiptPayAtCenter').val().trim() == '') {
                $('#fileUploadReceiptPayAtCenter').focus();
                iziToast.warning({ message: 'Please Select Attachment' });
                return false;
            }
        }

        var input = $('#fileUploadReceiptPayAtCenter');
        if (input.files && input.files[0]) {
            const filename = checkInputValidation((input.files[0].name).substring(0, input.files[0].name.lastIndexOf('.')));
            var extension = input.files[0].name.substr((input.files[0].name.lastIndexOf('.') + 1));
            if (extension.toUpperCase() == 'PDF' || extension.toUpperCase() == 'JPEG'
                || extension.toUpperCase() == 'JPG' || extension.toUpperCase() == 'PNG') {
                if (input.files[0].size > 500000) {
                    iziToast.warning({ message: 'Max size 500kb!', title: 'Warning!' });
                    return false;
                }
                else if (filename.isSpecialCharacters == true) {
                    iziToast.warning({ message: 'Special Characters Not Allowed In File Name', title: 'Warning!' });
                    return false;
                }
            }
            else {

                //iziToast.warning({ message: 'Please select PDF file only', title: 'Warning!' });
                iziToast.warning({ message: 'Unsupported file type', title: 'Warning!' });
                return false;
            }
        }

        var totalPayment = 0;
        var DemandArray = new Array();

        totalPayment = parseFloat($("#txtAmount").val().trim());

        if (parseFloat($('#hdnPayTotalAmount').val()) != parseFloat(totalPayment)) {
            return iziToast.warning({ message: 'Total amount and selected payment amount not match, Please again click on Proceed to Payment.' });
        }

        var fileData = new FormData();
        const files = $("#fileUploadReceiptPayAtCenter")[0].files;
        fileData.append('FILE_LIST', files[0]);
        if (files.length > 0) {
            FileDataByAppend(fileData);
        }

        var TransactionDate = null;
        if ($('#txtTransactionDate').val() != '') {
            var txtTransactionDate = $('#txtTransactionDate').val().split('/');
            TransactionDate = txtTransactionDate[2] + "/" + txtTransactionDate[1] + "/" + txtTransactionDate[0];
        }

        CreateDownPaymentDemand(totalPayment);
        var list = {
            DEMANDPG_ID: parseInt(demandpgId),
            INSTALLMENT_NO: parseInt(0),
            AMOUNT: parseFloat($("#txtAmount").val().trim())
        }
        DemandArray.push(list);

        var formData = {
            STUDENT_ID: studentId,
            TOTAL_AMOUNT: totalPayment,
            BANK_ID: $('#ddlBank').val(),
            AMOUNT: $('#txtAmount').val(),
            PAYMENT_CENTER: $('#txtPaymentCenter').val(),
            TRANSACTION_DATE: TransactionDate,
            REFERENCE_ID: $('#txtReferenceId').val(),
            PAYMENT_MODE: '2',
            IS_WANT_ORIGINAL_RECEIPT: Number($('#isOfficialReceiptPayeCenter').is(':checked')),
            PAGE_NAME: 'Enlistment/Index',
            DEMAND_TABLE: DemandArray
        };

        $('#btnSubmitPayAtPaymentCenter').prop('disabled', 'disabled').text('').append(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span><span class="">Loading...</span>`);
        $.ajax({
            url: "/Enlistment/SaveStudentPaymentPayAtOfflineData/",
            type: "POST",
            data: JSON.stringify(formData),
            contentType: "application/json;charset=utf-8",
            success: function (data) {
                if (data == -1) {
                    iziToast.warning({ message: 'Amount should be greater than 0!' });
                }
                else if (data == -2) {
                    iziToast.warning({ message: 'Invalid data!' });
                }
                else if (data == -3) {
                    iziToast.warning({ message: 'You can not pay amount greater than receivable amount!' });
                }
                else if (data == -4) {
                    iziToast.warning({ message: 'Something went wrong please try later or contact to ypur institute!' });
                }
                else if (data == -5) {
                    iziToast.warning({ message: 'You can not pay multiple currency payment at same time!' });
                }
                else {
                    CommonCallBack(data.substring(0, 3));
                }
                $('#btnSubmitPayAtPaymentCenter').removeAttr('disabled').empty().text('Submit');
                if (data == 1) {
                    $('#spnOnlinePayementSataus').removeClass("d-none"); $("#spnPayementExamptSataus").addClass("d-none");
                    $('#spnDownPayStaus,#divDownPayStatus').addClass("d-none");
                    $("#divPaymentDetails,#divAddDropPayStatus").addClass("d-none");
                    $('#txtAmount').val('');
                    $('#txtPaymentCenter').val('');
                    $('#txtTransactionDate').val('');
                    $('#txtReferenceId').val('');
                }
            }
        });
    });
    /*
NAME  : CreateDownPaymentDemand
DESC  : Creates demand for Enlistment Down payment.
PARAMS: NA
OUTPUT: r_out return 1 for success
*/
    function CreateDownPaymentDemand(totalPayment) {
        var DemandArray = new Array();
        var list = {
            FEESHEAD_ID: feeheadId,
            AMOUNT: totalPayment
        }
        DemandArray.push(list);

        var formData = {
            ACADEMIC_YEAR_ID: academicYearId,
            STUDENT_ID: studentId,
            COLLEGE_PROGRAM_ID: collegeProgramid,
            ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
            RECEIPT_TYPE_ID: receiptTypeId,
            MST_CURRENCY_ID: mstCurrencyId,
            DEMAND_TYPE: demandpgId == 0 ? 'N' : 'O',
            DEMANDPG_ID: demandpgId,
            PAGE_NAME: 'Enlistment/index',
            DEMAND_DETAILS_TBL: DemandArray
        }
        var formLogData = {
            ACADEMIC_YEAR_ID: academicYearId,
            STUDENT_ID: studentId,
            COLLEGE_PROGRAM_ID: collegeProgramid,
            ENROLLMENT_SEMESTER_ID: enrollmentSemesterId,
            RECEIPT_TYPE_ID: receiptTypeId,
            MST_CURRENCY_ID: mstCurrencyId,
            DEMAND_TYPE: 'Down Payment',
            DEMANDPG_ID: demandpgId,
            PAGE_NAME: 'Enlistment/index',
            FEESHEAD_ID: feeheadId,
            AMOUNT: demandAmount,
            CAMPUSNO: campusNo,
            PAYMENT_MODE_NAME: 'AT CAMPUS'
        }
        DownPaymentSubmitLog(formLogData);

        if (demandpgId == 0 && DemandCount == 0) {
            $.ajax({
                url: "/OnlinePaymentRequest/CreateDemandRequest/",
                dataType: "json",
                method: 'post',
                data: JSON.stringify(formData),
                contentType: "application/json;charset=utf-8",
                async: false,
                success: function (data) {
                    if (data.IS_SUCCESS == 1) {
                        demandpgId = data.DEMANDPG_ID;
                        DemandCount++;
                    }
                    else {
                        iziToast.warning({ message: 'Unable to create down-payment demand !' });
                        return false;
                    }

                },
                error: function (err) {
                    console.log(err);
                }
            });
        }
    }
    /*
  NAME  : FileDataByAppend
  DESC  : Appends file data to the session.
  PARAMS: fileData: FormData object containing file data to be appended.
  OUTPUT: NA
*/
    function FileDataByAppend(fileData) {
        // console.log(fileData);
        $.ajax({
            url: "/MyPayments/FileSession/",
            type: "POST",
            data: fileData,
            processData: false,
            contentType: false,
            async: false,
            success: function (data) {
            }
        });
    }
    /*
NAME  : DownPaymentSubmitLog
DESC  : Creates demand log for Enlistment Down payment.
PARAMS: NA
OUTPUT: r_out return 1 for success
*/
    async function DownPaymentSubmitLog(formData) {
        let data = await $.ajax({
            url: "/Enlistment/CreateDemandRequestLog/",
            dataType: "json",
            method: 'post',
            data: JSON.stringify(formData),
            contentType: "application/json;charset=utf-8"
        });
        //async: false,
        /* success: function (data) {*/
        if (data.length > 0) {
            return true;
        }
        //},
        //error: function (err) {
        //    console.log(err);
        //}
    }
    return {
        Init: init
    }

}();
/* 
  NAME  : DateRangePickerApplyHandler
  DESC  : Handles the 'apply' event of the date range picker.
  PARAMS: ev - The event object, picker - The date range picker object
  OUTPUT: NA
*/
$('.dateRange-current-append').on('apply.daterangepicker', function (ev, picker) {
    $(this).val(picker.startDate.format('DD/MM/YYYY'));
});
var inputs = document.querySelectorAll('.dateRange-current-append');
for (var i = 0; i < inputs.length; i++) {
    new Cleave(inputs[i], {
        date: true,
        delimiter: '/',
        datePattern: ['d', 'm', 'Y']
    });
}
/* 
  NAME  : InitializeDateRangePicker
  DESC  : Initializes the date range picker with specified options.
  PARAMS: NA
  OUTPUT: NA
*/
$(function () {
    var minDate = new Date();
    var minDays = 100;
    var minDateresult = minDate.setDate(minDate.getDate() - minDays);
    var maxDate = new Date();
    var maxDays = 0;
    var maxDateresult = maxDate.setDate(maxDate.getDate() - maxDays);
    $('.dateRange-current-append').daterangepicker({
        singleDatePicker: true,
        showDropdowns: true,
        timePicker: false,
        locale: {
            format: 'DD/MM/YYYY',
            cancelLabel: 'Clear'
        },
        autoUpdateInput: false,
        minDate: new Date(minDateresult),
        maxDate: new Date(maxDateresult)
    });
})

function GenerateStudentId(formData) {
    $.ajax({
        url: "/Enlistment/StudentIdBulkGenerateSave/",
        type: "POST",
        data: JSON.stringify(formData),
        contentType: "application/json;charset=utf-8",
        //async: true,
        success: function (data) {
            return true;
        },
        error: function (errResponse) {
            console.log(errResponse);
        }
    })
}

var IsViewOtherPaymentPlann = $('#IsViewOtherPaymentPlann');
$(IsViewOtherPaymentPlann).on('change', function () {
    if ($(IsViewOtherPaymentPlann).prop('checked')) {
        $('#configPPPaymentPlan').parent().removeClass('hide');
        $(".switch-text[for='IsViewOtherPaymentPlann']").text('Yes');
        $("#ddlPPPaymentPlan").val(0).select2({
            dropdownParent: $('#PaymentPreviewModal')
        });
    } else {
        $('#configPPPaymentPlan').parent().addClass('hide');
        $(".switch-text[for='IsViewOtherPaymentPlann']").text('No');
        $('#tblViewOtherPaymentPlan').parent().addClass('hide');
        $("#ddlPPPaymentPlan").val(0).select2({
            dropdownParent: $('#PaymentPreviewModal')
        });
    }
})

$("#ddlPPPaymentPlan").on('change', function () {
    if ($("#ddlPPPaymentPlan").val() == 0) {
        $('#tblViewOtherPaymentPlan').parent().addClass('hide');
    }
    else {
        $('#tblViewOtherPaymentPlan').parent().removeClass('hide');

        var CourseList = new Array();
        $("#tblRegularCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblElectiveCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkECourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblGlobalCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkGCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblRestudyCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkRestudyCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnRestudyCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblMinorMajorCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkMinorMajorOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });
        $("#tblSpecialCourses tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkSpecialCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 1, CAMPUSNO: campusNo });
            }
        });
        $("#tblNotEnlisted tbody tr").each(function () {
            if (Number($(this).find($('[id ^= chkNCourseOfferChlId]')).is(":checked")) == 1) {
                CourseList.push({ COURSE_CREATION_ID: $(this).find($('[id^=hdnCourseCreationId]')).val(), IS_SPECIAL: 0, CAMPUSNO: campusNo });
            }
        });

        if (CourseList.length == 0) {
            iziToast.warning({ message: 'Please select atleast one Course !' });
            $("#PaymentPreviewModal").modal('hide');
            return false;
        }
        else {
            $("#PaymentPreviewModal").modal('show');
        }
        DistinctCourses = [];
        $.each(CourseList, function (index, row) {
            if (!DistinctCourses.find(x => x.COURSE_CREATION_ID == row.COURSE_CREATION_ID)) {
                DistinctCourses.push(row);
            }
        })
        var data = { COLLEGE_PROGRAM_ID: collegeProgramid, ENROLLMENT_SEMESTER_ID: enrollmentSemesterId, ENROLLMENT_PAYMENT_TYPE_ID: PaymentTypeId, COURSES_TBL: DistinctCourses, ACADEMIC_SESSION_ID: $("#hdfAcademicSessionId").val(), INSTALLMENT_PAYMENT_PLAN_CONFIG_ID: $("#ddlPPPaymentPlan").val() }
        $.ajax({
            url: "/Enlistment/GetFeesDetailsPreviewByPaymentPlan/",
            type: 'post',
            data: data,
            dataType: "json",
            async: false,
            success: function (data) {
                $('#tblViewOtherPaymentPlan tbody').empty();
                $('#divPlanOverAllcharge').addClass("d-none");
                if (data.length > 0) {

                    $('#DivPaymentPlanGrid').removeClass("d-none");
                    $('#divShowInstallment').removeClass("d-none");
                    $("#spnPlanOverallCharge").html('-');
                    if (data[0].IS_OVERALL_CHARGES == 1) {
                        $("#spnPlanOverallCharge").html(data[0].CHARGES_AMOUNT);
                        $('#divPlanOverAllcharge').removeClass("d-none");
                        $('#pCheckFlag').addClass("d-none");
                    } else {
                        $("#spnPlanOverallCharge").html('-');
                        $('#divPlanOverAllcharge').addClass("d-none");
                        $('#pCheckFlag').removeClass("d-none");
                    }

                    $.each(data, function (index, row) {
                        var html = `<tr>
                                       <td>Installment - ${row.INSTALLMENT_NO}</td>
                                       <td>${row.AMOUNT}</td>
                                       <td>${row.INSTALLMENT_DATE == null ? "" : row.INSTALLMENT_DATE}</td>
                                       <td>${row.PAID_AMOUNT}</td>
                                       <td>${row.SCHOLARSHIP_AMOUNT}</td>
                                       <td>${row.BALANCE_AMOUNT}</td>`
                        if (data[0].IS_OVERALL_CHARGES == 0) {
                            html += `<td>${row.CHARGES_AMOUNT}</td>`
                        }
                        if (row.INSTALLMENT_STATUS == 0) {
                            html += `<td><span class="badge badge-warning badge-outline">Unpaid</span></td>
                                   </tr>`;
                        }
                        else if (row.INSTALLMENT_STATUS == 1) {
                            html += `<td><span class="badge badge-success badge-outline">Paid</span></td>
                                   </tr>`;
                        }
                        $('#tblViewOtherPaymentPlan tbody').append(html);
                    })
                } else {
                    $('#DivPaymentPlanGrid').addClass("d-none"); $("#spnPlanOverallCharge").val('-');
                    $('#divPlanOverAllcharge').addClass("d-none");
                }

            }
        });
    }
})

