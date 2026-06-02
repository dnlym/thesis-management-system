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
    const getClassification = (score: number): { label: string; color: string; letter: string; point4: string; status: string } => {
        if (score >= 9.0) return { label: 'A+', color: 'text-purple-600', letter: 'A+', point4: '4.0', status: 'Đạt' };
        if (score >= 8.5) return { label: 'A', color: 'text-blue-600', letter: 'A', point4: '3.8', status: 'Đạt' };
        if (score >= 8.0) return { label: 'B+', color: 'text-blue-500', letter: 'B+', point4: '3.5', status: 'Đạt' };
        if (score >= 7.0) return { label: 'B', color: 'text-green-600', letter: 'B', point4: '3.0', status: 'Đạt' };
        if (score >= 6.0) return { label: 'C+', color: 'text-green-500', letter: 'C+', point4: '2.5', status: 'Đạt' };
        if (score >= 5.5) return { label: 'C', color: 'text-red-500', letter: 'C', point4: '2.0', status: 'Không đạt' };
        if (score >= 5.0) return { label: 'D+', color: 'text-red-500', letter: 'D+', point4: '1.5', status: 'Không đạt' };
        if (score >= 4.0) return { label: 'D', color: 'text-red-500', letter: 'D', point4: '1.0', status: 'Không đạt' };
        return { label: 'F', color: 'text-red-600', letter: 'F', point4: '0.0', status: 'Không đạt' };
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
                        {finalScore?.advisor_score && (
                            <span className="text-2xl font-bold text-iuh-blue">
                                {formatScore(finalScore.advisor_score)}
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
                        {finalScore?.avg_reviewer_score && (
                            <span className="text-2xl font-bold text-iuh-green">
                                {formatScore(finalScore.avg_reviewer_score)}
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
                                    <div key={index} className="p-3 bg-slate-50 rounded-md">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium text-sm">
                                                Phản biện: {grade.rater_name || `Phản biện ${index + 1}`}
                                            </span>
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
                        {finalScore?.avg_council_score && (
                            <span className="text-2xl font-bold text-purple-600">
                                {formatScore(finalScore.avg_council_score)}
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
                                    <div key={index} className="p-3 bg-slate-50 rounded-md">
                                        <div className="flex justify-between mb-2">
                                            <span className="font-medium text-sm">
                                                {roleLabels[index] || 'Thành viên'}: {grade.rater_name || `Thành viên ${index + 1}`}
                                            </span>
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
            {finalScore?.finalized && finalScore.final_score !== null && (
                <Card className="border-2 border-iuh-blue">
                    <CardHeader className="bg-gradient-to-r from-iuh-blue/10 to-purple-50">
                        <CardTitle className="text-xl text-center">Điểm Tổng kết</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="text-center space-y-4">
                            <div>
                                <p className="text-sm text-gray-600 mb-1">Điểm tổng hợp</p>
                                <p className="text-3xl font-bold">{formatScore(finalScore.computed_score)}</p>
                            </div>

                            {finalScore.extra_points && finalScore.extra_points > 0 && (
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">Điểm cộng</p>
                                    <p className="text-xl font-semibold text-iuh-green">
                                        +{formatScore(finalScore.extra_points)}
                                    </p>
                                </div>
                            )}

                            <div className="border-t-2 border-dashed pt-4">
                                <p className="text-sm text-gray-600 mb-2">Điểm cuối cùng</p>
                                <p className="text-5xl font-bold text-iuh-blue mb-2">
                                    {formatScore(finalScore.final_score)}
                                    <span className="text-2xl text-gray-400">/10</span>
                                </p>
                                <div className="flex justify-center gap-4 mt-3">
                                    <div className="px-3 py-1 bg-slate-100 rounded-lg">
                                        <span className="text-xs text-slate-500 block">Thang 4</span>
                                        <span className="font-bold text-slate-700">{getClassification(finalScore.final_score).point4}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-slate-100 rounded-lg">
                                        <span className="text-xs text-slate-500 block">Điểm chữ</span>
                                        <span className={`font-bold ${getClassification(finalScore.final_score).color}`}>{getClassification(finalScore.final_score).letter}</span>
                                    </div>
                                    <div className="px-3 py-1 bg-slate-100 rounded-lg">
                                        <span className="text-xs text-slate-500 block">Đánh giá</span>
                                        <span className={`font-bold ${getClassification(finalScore.final_score).status === 'Đạt' ? 'text-green-600' : 'text-red-600'}`}>
                                            {getClassification(finalScore.final_score).status}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
