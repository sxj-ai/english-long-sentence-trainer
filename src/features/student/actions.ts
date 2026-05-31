"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function getAnswerFromForm(formData: FormData, questionId: string) {
  return String(formData.get(`answer-${questionId}`) ?? "").trim();
}

async function assignGradingTaskForLatestSubmission(input: {
  actorUserId: string;
  examId: string;
  examTitle: string;
  classId: string;
  submitterStudentId: string;
  submissionId: string;
}) {
  const classmates = await prisma.studentProfile.findMany({
    where: {
      classId: input.classId,
      status: "ACTIVE"
    },
    orderBy: [{ studentNo: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      realName: true,
      studentNo: true
    }
  });
  const submitterIndex = classmates.findIndex((student) => student.id === input.submitterStudentId);
  const safeSubmitterIndex = submitterIndex >= 0 ? submitterIndex : 0;
  const grader =
    classmates.length > 1
      ? classmates[(safeSubmitterIndex + 1) % classmates.length]
      : classmates[safeSubmitterIndex] ?? { id: input.submitterStudentId, realName: "本人", studentNo: "" };
  const existingAssignments = await prisma.gradingAssignment.findMany({
    where: {
      examId: input.examId,
      submitterStudentId: input.submitterStudentId
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      id: true
    }
  });
  const assignedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const assignmentIds = existingAssignments.map((assignment) => assignment.id);
    let assignmentId: string;

    if (assignmentIds.length > 0) {
      const oldResults = await tx.gradingResult.findMany({
        where: {
          assignmentId: {
            in: assignmentIds
          }
        },
        select: {
          id: true
        }
      });
      const oldResultIds = oldResults.map((result) => result.id);

      await tx.examScore.deleteMany({
        where: {
          examId: input.examId,
          studentId: input.submitterStudentId
        }
      });

      if (oldResultIds.length > 0) {
        await tx.gradingItem.deleteMany({
          where: {
            gradingResultId: {
              in: oldResultIds
            }
          }
        });
        await tx.gradingResult.deleteMany({
          where: {
            id: {
              in: oldResultIds
            }
          }
        });
      }

      assignmentId = assignmentIds[0];

      await tx.gradingAssignment.update({
        where: { id: assignmentId },
        data: {
          graderStudentId: grader.id,
          status: "READY",
          assignedAt,
          gradedAt: null
        }
      });

      if (assignmentIds.length > 1) {
        await tx.gradingAssignment.updateMany({
          where: {
            id: {
              in: assignmentIds.slice(1)
            }
          },
          data: {
            status: "REASSIGNED"
          }
        });
      }
    } else {
      const assignment = await tx.gradingAssignment.create({
        data: {
          examId: input.examId,
          submitterStudentId: input.submitterStudentId,
          graderStudentId: grader.id,
          status: "READY",
          assignedAt
        }
      });

      assignmentId = assignment.id;
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: "ASSIGN_GRADING_TASK",
        targetType: "GradingAssignment",
        targetId: assignmentId,
        payloadJson: {
          examId: input.examId,
          examTitle: input.examTitle,
          submissionId: input.submissionId,
          submitterStudentId: input.submitterStudentId,
          graderStudentId: grader.id,
          graderName: grader.realName,
          graderStudentNo: grader.studentNo
        }
      }
    });
  });
}

export async function submitExamAction(formData: FormData) {
  const studentUser = await requireUser("STUDENT");
  const examId = String(formData.get("examId") ?? "").trim();

  if (!examId) {
    redirect("/student/exams?error=missing-exam");
  }

  const student = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id }
  });

  if (!student) {
    redirect("/student?error=student-profile-missing");
  }

  if (!student.classId || student.status !== "ACTIVE") {
    redirect("/student/exams?error=no-class");
  }

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        orderBy: {
          orderIndex: "asc"
        }
      }
    }
  });

  if (!exam || exam.classId !== student.classId) {
    redirect("/student/exams?error=exam-not-found");
  }

  if (exam.status === "CLOSED") {
    redirect(`/student/exams/${exam.id}?error=closed`);
  }

  if (exam.status !== "PUBLISHED") {
    redirect("/student/exams?error=exam-not-found");
  }

  const now = new Date();

  if (exam.startAt && exam.startAt > now) {
    redirect(`/student/exams/${exam.id}?error=not-started`);
  }

  if (exam.submitDeadline && exam.submitDeadline < now) {
    redirect(`/student/exams/${exam.id}?error=deadline-passed`);
  }

  const existingSubmissionCount = await prisma.examSubmission.count({
    where: {
      examId: exam.id,
      studentId: student.id,
      status: "SUBMITTED"
    }
  });

  if (!exam.allowResubmit && existingSubmissionCount > 0) {
    redirect(`/student/exams/${exam.id}/result?error=resubmit-disabled`);
  }

  const attemptAggregate = await prisma.examSubmission.aggregate({
    where: {
      examId: exam.id,
      studentId: student.id
    },
    _max: {
      attemptNo: true
    }
  });
  const attemptNo = (attemptAggregate._max.attemptNo ?? 0) + 1;

  const submission = await prisma.examSubmission.create({
    data: {
      examId: exam.id,
      studentId: student.id,
      attemptNo,
      status: "SUBMITTED",
      submittedAt: now,
      answers: {
        create: exam.questions.map((question) => ({
          examQuestionId: question.id,
          answerText: getAnswerFromForm(formData, question.id)
        }))
      }
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: studentUser.id,
      action: "SUBMIT_EXAM",
      targetType: "ExamSubmission",
      targetId: submission.id,
      payloadJson: {
        examId: exam.id,
        examTitle: exam.title,
        attemptNo,
        answerCount: exam.questions.length
      }
    }
  });

  await assignGradingTaskForLatestSubmission({
    actorUserId: studentUser.id,
    examId: exam.id,
    examTitle: exam.title,
    classId: exam.classId,
    submitterStudentId: student.id,
    submissionId: submission.id
  });

  redirect(`/student/exams/${exam.id}/result?submitted=1`);
}

export async function submitGradingAction(formData: FormData) {
  const studentUser = await requireUser("STUDENT");
  const assignmentId = String(formData.get("assignmentId") ?? "").trim();

  if (!assignmentId) {
    redirect("/student/grading?error=missing-assignment");
  }

  const grader = await prisma.studentProfile.findUnique({
    where: { userId: studentUser.id }
  });

  if (!grader || !grader.classId || grader.status !== "ACTIVE") {
    redirect("/student/grading?error=no-class");
  }

  const assignment = await prisma.gradingAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      exam: {
        include: {
          questions: {
            orderBy: {
              orderIndex: "asc"
            }
          }
        }
      },
      submitter: true
    }
  });

  if (!assignment || assignment.graderStudentId !== grader.id || assignment.status !== "READY") {
    redirect("/student/grading?error=assignment-not-found");
  }

  if (assignment.exam.classId !== grader.classId || assignment.exam.status !== "PUBLISHED") {
    redirect("/student/grading?error=assignment-not-found");
  }

  if (assignment.exam.gradingDeadline && assignment.exam.gradingDeadline < new Date()) {
    redirect(`/student/grading/${assignment.id}?error=grading-deadline-passed`);
  }

  const submission = await prisma.examSubmission.findFirst({
    where: {
      examId: assignment.examId,
      studentId: assignment.submitterStudentId,
      status: "SUBMITTED"
    },
    orderBy: {
      attemptNo: "desc"
    }
  });

  if (!submission) {
    redirect(`/student/grading/${assignment.id}?error=no-submission`);
  }

  const items = assignment.exam.questions.map((question) => {
    const isCorrect = String(formData.get(`correct-${question.id}`) ?? "") === "true";

    return {
      examQuestionId: question.id,
      isCorrect,
      score: isCorrect ? question.score : 0
    };
  });
  const totalScore = items.reduce((sum, item) => sum + item.score, 0);
  const maxScore = assignment.exam.questions.reduce((sum, question) => sum + question.score, 0);
  const submittedAt = new Date();

  await prisma.$transaction(async (tx) => {
    const oldResults = await tx.gradingResult.findMany({
      where: {
        assignmentId: assignment.id
      },
      select: {
        id: true
      }
    });
    const oldResultIds = oldResults.map((result) => result.id);

    await tx.examScore.deleteMany({
      where: {
        examId: assignment.examId,
        studentId: assignment.submitterStudentId
      }
    });

    if (oldResultIds.length > 0) {
      await tx.gradingItem.deleteMany({
        where: {
          gradingResultId: {
            in: oldResultIds
          }
        }
      });
      await tx.gradingResult.deleteMany({
        where: {
          id: {
            in: oldResultIds
          }
        }
      });
    }

    const result = await tx.gradingResult.create({
      data: {
        assignmentId: assignment.id,
        submissionId: submission.id,
        graderStudentId: grader.id,
        totalScore,
        maxScore,
        submittedAt,
        items: {
          create: items
        }
      }
    });

    await tx.examScore.create({
      data: {
        examId: assignment.examId,
        studentId: assignment.submitterStudentId,
        submissionId: submission.id,
        gradingResultId: result.id,
        totalScore,
        maxScore,
        finalizedAt: submittedAt
      }
    });

    await tx.gradingAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "GRADED",
        gradedAt: submittedAt
      }
    });

    await tx.auditLog.create({
      data: {
        actorUserId: studentUser.id,
        action: "SUBMIT_GRADING_RESULT",
        targetType: "GradingResult",
        targetId: result.id,
        payloadJson: {
          examId: assignment.examId,
          examTitle: assignment.exam.title,
          submitterStudentId: assignment.submitterStudentId,
          submitterName: assignment.submitter.realName,
          submissionId: submission.id,
          totalScore,
          maxScore
        }
      }
    });
  });

  redirect(`/student/grading/${assignment.id}?graded=1`);
}
