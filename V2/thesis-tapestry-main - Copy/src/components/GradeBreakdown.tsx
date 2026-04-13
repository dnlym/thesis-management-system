import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import type { FinalScore, Grade } from '@/types';

interface GradeBreakdownProps {
    advisorGrade?: Grade;
    reviewerGrades: Grade[];
    councilGrades: Grade[];
    finalScore?: FinalScore;
}

export function GradeBreakdown({
    advisorGrade,
    reviewerGrades,
    councilGrades,
    finalScore,
}: GradeBreakdownProps) {
    const getClassification = (score: number): { label: string; color: string } => {
        if (score >= 9.0) return { label: 'Xuất sắc', color: 'text-purple-600' };
        if (score >= 8.0) return { label: 'Giỏi', color: 'text-blue-600' };
        if (score >= 7.0) return { label: 'Khá', color: 'text-green-600' };
        if (score >= 5.5) return { label: 'Trung bình', color: 'text-yellow-600' };
        return { label: 'Yếu', color: 'text-red-600' };
    };

    const calculateAverage = (scores: number[]) => {
        if (scores.length === 0) return 0;
        return scores.reduce((a, b) => a + b, 0) / scores.length;
    };

    const formatScore = (score: number | null | undefined) => {
        return score !== null && score !== undefined ? score.toFixed(2) : 'N/A';
    };

    return (
        <div className="space-y-4">
            {/* Advisor Grade */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Điểm Hướng dẫn (40%)</span>
                        {finalScore?.advisorScore && (
                            <span className="text-2xl font-bold text-blue-600">
                                {formatScore(finalScore.advisorScore)}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {advisorGrade ? (
                        <div className="space-y-2">
                            {advisorGrade.scores.map((score, index) => (
                                <div key={index} className="space-y-1">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Tiêu chí {index + 1}</span>
                                        <span className="font-medium">{formatScore(score.score)}/10</span>
                                    </div>
                                    {score.comment && (
                                        <p className="text-xs text-gray-500 italic">{score.comment}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Chưa có điểm hướng dẫn</p>
                    )}
                </CardContent>
            </Card>

            {/* Reviewer Grades */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Điểm Phản biện (40%)</span>
                        {finalScore?.avgReviewerScore && (
                            <span className="text-2xl font-bold text-green-600">
                                {formatScore(finalScore.avgReviewerScore)}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {reviewerGrades.length > 0 ? (
                        <div className="space-y-3">
                            {reviewerGrades.map((grade, index) => {
                                const avgScore = calculateAverage(grade.scores.map((s) => s.score));
                                return (
                                    <div key={index} className="p-3 bg-gray-50 rounded-md">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium text-sm">Phản biện {index + 1}</span>
                                            <span className="font-bold">{formatScore(avgScore)}/10</span>
                                        </div>
                                        <Progress value={avgScore * 10} className="h-2" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Chưa có điểm phản biện</p>
                    )}
                </CardContent>
            </Card>

            {/* Council Grades */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                        <span>Điểm Hội đồng (20%)</span>
                        {finalScore?.avgCouncilScore && (
                            <span className="text-2xl font-bold text-purple-600">
                                {formatScore(finalScore.avgCouncilScore)}
                            </span>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {councilGrades.length > 0 ? (
                        <div className="space-y-3">
                            {councilGrades.map((grade, index) => {
                                const avgScore = calculateAverage(grade.scores.map((s) => s.score));
                                const roleLabels = ['Chủ tịch', 'Thư ký', 'Ủy viên'];
                                return (
                                    <div key={index} className="p-3 bg-gray-50 rounded-md">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium text-sm">{roleLabels[index] || `Thành viên ${index + 1}`}</span>
                                            <span className="font-bold">{formatScore(avgScore)}/10</span>
                                        </div>
                                        <Progress value={avgScore * 10} className="h-2" />
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">Chưa có điểm hội đồng</p>
                    )}
                </CardContent>
            </Card>

            {/* Final Score */}
            {finalScore?.finalized && finalScore.finalScore !== null && (
                <Card className="border-2 border-blue-500">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                        <CardTitle className="text-xl text-center">Điểm Tổng kết</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Điểm tổng hợp</p>
                                <p className="text-3xl font-bold">{formatScore(finalScore.computedScore)}</p>
                            </div>

                            {finalScore.extraPoints && finalScore.extraPoints > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Điểm cộng</p>
                                    <p className="text-xl font-semibold text-green-600">
                                        +{formatScore(finalScore.extraPoints)}
                                    </p>
                                </div>
                            )}

                            <div className="border-t-2 border-dashed pt-4">
                                <p className="text-sm text-gray-600 mb-2">Điểm cuối cùng</p>
                                <p className="text-5xl font-bold text-blue-600 mb-2">
                                    {formatScore(finalScore.finalScore)}
                                    <span className="text-2xl text-gray-400">/10</span>
                                </p>
                                {finalScore.classification && (
                                    <p className={`text-xl font-semibold ${getClassification(finalScore.finalScore).color}`}>
                                        {getClassification(finalScore.finalScore).label}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
